import express from 'express';
import {
  AirQualityQuerySchema,
  AssistantChatRequestSchema,
  GeneratePlanRequestSchema,
} from '../shared/schemas.ts';
import type { AirQualityContext, PlanningScenarioId } from '../shared/types.ts';
import { resolveAirQualityContext } from './airQualityService.ts';
import {
  askGroundedAssistant,
  generatePersonalizedPlan,
  type GeminiClientAdapter,
} from './geminiService.ts';

export interface RateLimitConfig {
  windowMs?: number;
  aqMaxRequests?: number;
  aiMaxRequests?: number;
  disabled?: boolean;
}

export interface AppDependencies {
  fetchImpl?: typeof fetch;
  geminiAdapter?: GeminiClientAdapter | null;
  resolveAirQuality?: (
    city: string,
    scenario: PlanningScenarioId,
    options?: { forceRefresh?: boolean }
  ) => Promise<AirQualityContext>;
  rateLimit?: RateLimitConfig;
  allowedOriginHosts?: readonly string[];
}

function createFixedWindowRateLimiter(windowMs: number, maxRequests: number) {
  const MAX_TRACKED_CLIENTS = 1000;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const now = Date.now();
    if (buckets.size >= MAX_TRACKED_CLIENTS) {
      for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(key);
        }
      }
      if (buckets.size >= MAX_TRACKED_CLIENTS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) {
          buckets.delete(oldestKey);
        }
      }
    }

    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const existing = buckets.get(clientKey);
    if (!existing || existing.resetAt <= now) {
      buckets.set(clientKey, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before retrying.',
      });
      return;
    }

    existing.count += 1;
    next();
  };
}

function resolveConfiguredAppHost(): string | null {
  const appUrl = process.env.APP_URL;
  if (!appUrl || appUrl === 'MY_APP_URL') return null;
  try {
    return new URL(appUrl).host.toLowerCase();
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function runAbortableJsonHandler<T>(
  res: express.Response,
  execute: (signal: AbortSignal) => Promise<T>,
  fallbackErrorMessage: string
): Promise<void> {
  const requestAbort = new AbortController();
  const onClose = () => {
    if (!res.writableFinished) {
      requestAbort.abort();
    }
  };
  res.on('close', onClose);

  try {
    const result = await execute(requestAbort.signal);
    if (!res.writableFinished) {
      res.json(result);
    }
  } catch {
    if (!res.writableFinished && !requestAbort.signal.aborted) {
      res.status(500).json({ error: fallbackErrorMessage });
    }
  } finally {
    res.off('close', onClose);
  }
}

export function createApiApp(deps: AppDependencies = {}) {
  const app = express();
  const configuredAppHost = resolveConfiguredAppHost();
  const extraAllowedHosts = new Set(
    (deps.allowedOriginHosts ?? []).map((host) => host.toLowerCase())
  );

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Enforce strict API security headers & same-origin browser request guard
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');

    const originHeader = req.get('origin');
    if (originHeader) {
      let originHost: string | null = null;
      try {
        originHost = new URL(originHeader).host.toLowerCase();
      } catch {
        originHost = null;
      }
      const requestHost = req.get('host')?.toLowerCase() ?? null;
      const isAllowedOrigin =
        originHost !== null &&
        ((requestHost !== null && originHost === requestHost) ||
          (configuredAppHost !== null && originHost === configuredAppHost) ||
          extraAllowedHosts.has(originHost));

      if (!isAllowedOrigin) {
        res.status(403).json({ error: 'Cross-origin API requests are not permitted.' });
        return;
      }
    }

    next();
  });

  app.use(express.json({ limit: '100kb' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      err.type === 'entity.too.large'
    ) {
      res.status(413).json({ error: 'Request payload exceeds maximum allowed size.' });
      return;
    }
    next(err);
  });

  const rateWindowMs = deps.rateLimit?.windowMs ?? 60_000;
  const aqLimiter = deps.rateLimit?.disabled
    ? (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
    : createFixedWindowRateLimiter(rateWindowMs, deps.rateLimit?.aqMaxRequests ?? 60);
  const aiLimiter = deps.rateLimit?.disabled
    ? (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()
    : createFixedWindowRateLimiter(rateWindowMs, deps.rateLimit?.aiMaxRequests ?? 30);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clearair-daily' });
  });

  app.get('/api/air-quality', aqLimiter, async (req, res) => {
    const allowedQueryKeys = new Set(['city', 'scenario', 'refresh']);
    const queryEntries = Object.entries(req.query);
    const hasUnexpectedOrNonStringParam = queryEntries.some(
      ([key, value]) => !allowedQueryKeys.has(key) || typeof value !== 'string'
    );
    if (hasUnexpectedOrNonStringParam) {
      res.status(400).json({ error: 'Invalid query parameters.' });
      return;
    }

    const parsed = AirQualityQuerySchema.safeParse({
      city: req.query.city,
      ...(req.query.scenario !== undefined ? { scenario: req.query.scenario } : {}),
      ...(req.query.refresh !== undefined ? { refresh: req.query.refresh } : {}),
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'Please enter a valid city name (2 to 80 characters) and valid scenario parameters.',
      });
      return;
    }

    const forceRefresh = parsed.data.refresh === 'true';

    try {
      const aq = deps.resolveAirQuality
        ? await deps.resolveAirQuality(parsed.data.city, parsed.data.scenario, { forceRefresh })
        : await resolveAirQualityContext(parsed.data.city, parsed.data.scenario, deps.fetchImpl, {
            forceRefresh,
          });
      res.json(aq);
    } catch {
      res.status(502).json({
        error: 'Unable to retrieve air-quality context right now. Please try a planning scenario or retry.',
      });
    }
  });

  app.post('/api/plan/generate', aiLimiter, async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Request body is required.' });
      return;
    }

    const parsed = GeneratePlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid household profile or air-quality context payload.',
      });
      return;
    }

    await runAbortableJsonHandler(
      res,
      (signal) =>
        generatePersonalizedPlan(
          parsed.data.profile,
          parsed.data.airQuality,
          deps.geminiAdapter,
          { signal }
        ),
      'Unable to generate daily plan at this moment.'
    );
  });

  app.post('/api/assistant/chat', aiLimiter, async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Request body is required.' });
      return;
    }

    const parsed = AssistantChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Please provide a valid question (2 to 600 characters) and active context.',
      });
      return;
    }

    await runAbortableJsonHandler(
      res,
      (signal) => askGroundedAssistant(parsed.data, deps.geminiAdapter, { signal }),
      'Assistant is temporarily unavailable. Please retry shortly.'
    );
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use(
    (
      _err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error.' });
      }
    }
  );

  return app;
}
