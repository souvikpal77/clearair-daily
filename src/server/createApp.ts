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

export interface AppDependencies {
  fetchImpl?: typeof fetch;
  geminiAdapter?: GeminiClientAdapter | null;
  resolveAirQuality?: (
    city: string,
    scenario: PlanningScenarioId,
    options?: { forceRefresh?: boolean }
  ) => Promise<AirQualityContext>;
}

export function createApiApp(deps: AppDependencies = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '100kb' }));

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clearair-daily' });
  });

  app.get('/api/air-quality', async (req, res) => {
    const parsed = AirQualityQuerySchema.safeParse({
      city: typeof req.query.city === 'string' ? req.query.city : '',
      scenario: typeof req.query.scenario === 'string' ? req.query.scenario : 'live',
      refresh: typeof req.query.refresh === 'string' ? req.query.refresh : 'false',
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'Please enter a valid city name (2 to 80 characters).',
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

  app.post('/api/plan/generate', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
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

    try {
      const result = await generatePersonalizedPlan(
        parsed.data.profile,
        parsed.data.airQuality,
        deps.geminiAdapter
      );
      res.json(result);
    } catch {
      res.status(500).json({
        error: 'Unable to generate daily plan at this moment.',
      });
    }
  });

  app.post('/api/assistant/chat', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
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

    try {
      const result = await askGroundedAssistant(parsed.data, deps.geminiAdapter);
      res.json(result);
    } catch {
      res.status(500).json({
        error: 'Assistant is temporarily unavailable. Please retry shortly.',
      });
    }
  });

  return app;
}
