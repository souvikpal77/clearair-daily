import { buildEstimatedScenarioContext } from '../core/aqCategorizer.ts';
import {
  normalizeGeocodeMatch,
  normalizeOpenMeteoAqPayload,
} from '../core/aqNormalizer.ts';
import type { AirQualityContext, PlanningScenarioId } from '../shared/types.ts';

interface CachedEntry {
  context: AirQualityContext;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const DEFAULT_FETCH_TIMEOUT_MS = 4500;
const ALLOWED_UPSTREAM_HOSTS = new Set([
  'geocoding-api.open-meteo.com',
  'air-quality-api.open-meteo.com',
]);

const cache = new Map<string, CachedEntry>();
const inflightRequests = new Map<string, Promise<AirQualityContext>>();
const inflightRefreshRequests = new Map<string, Promise<AirQualityContext>>();

export function clearAirQualityCache(): void {
  cache.clear();
  inflightRequests.clear();
  inflightRefreshRequests.clear();
}

export function assertAllowedUpstreamUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' || !ALLOWED_UPSTREAM_HOSTS.has(parsed.hostname)) {
    throw new Error('Blocked disallowed upstream request destination');
  }
  return parsed;
}

function setBoundedCacheEntry(key: string, entry: CachedEntry): void {
  const now = Date.now();
  for (const [existingKey, existingValue] of cache.entries()) {
    if (existingValue.expiresAt <= now) {
      cache.delete(existingKey);
    }
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, entry);
}

function sanitizeFallbackCity(city: string): string {
  const cleaned = city.replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 80) || 'Your City';
}

async function fetchJsonWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<unknown> {
  const safeUrl = assertAllowedUpstreamUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(safeUrl.toString(), {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface ResolveAirQualityOptions {
  forceRefresh?: boolean;
  timeoutMs?: number;
}

export async function resolveAirQualityContext(
  city: string,
  scenario: PlanningScenarioId = 'live',
  fetchImpl: typeof fetch = fetch,
  options: ResolveAirQualityOptions = {}
): Promise<AirQualityContext> {
  if (scenario !== 'live') {
    return buildEstimatedScenarioContext(city, scenario);
  }

  const normalizedKey = city.trim().toLowerCase();
  const isForceRefresh = Boolean(options.forceRefresh);

  if (isForceRefresh) {
    const existingRefresh = inflightRefreshRequests.get(normalizedKey);
    if (existingRefresh) {
      return existingRefresh;
    }
  } else {
    const cached = cache.get(normalizedKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    const inflight = inflightRequests.get(normalizedKey) ?? inflightRefreshRequests.get(normalizedKey);
    if (inflight) {
      return inflight;
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const targetInflightMap = isForceRefresh ? inflightRefreshRequests : inflightRequests;

  const lookupPromise = (async (): Promise<AirQualityContext> => {
    try {
      const geocodeUrl =
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}` +
        '&count=1&language=en&format=json';
      const rawGeo = await fetchJsonWithTimeout(geocodeUrl, fetchImpl, timeoutMs);
      const match = normalizeGeocodeMatch(rawGeo);

      if (!match) {
        const displayCity = sanitizeFallbackCity(city);
        return buildEstimatedScenarioContext(
          displayCity,
          'moderate_winter_haze',
          `Could not match "${displayCity}" in live geocoding. Showing an estimated moderate winter haze planning scenario (not live sensor data).`
        );
      }

      const aqUrl =
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(String(match.latitude))}&longitude=${encodeURIComponent(String(match.longitude))}` +
        '&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide&timezone=auto';

      const rawAq = await fetchJsonWithTimeout(aqUrl, fetchImpl, timeoutMs);
      const context = normalizeOpenMeteoAqPayload({ match, rawAq });

      if (context.dataSource === 'live') {
        setBoundedCacheEntry(normalizedKey, {
          context,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }

      return context;
    } catch {
      return buildEstimatedScenarioContext(
        sanitizeFallbackCity(city),
        'moderate_winter_haze',
        `Live air-quality telemetry is temporarily unreachable. Showing an estimated moderate winter haze planning scenario (not live data).`
      );
    } finally {
      targetInflightMap.delete(normalizedKey);
    }
  })();

  targetInflightMap.set(normalizedKey, lookupPromise);

  return lookupPromise;
}
