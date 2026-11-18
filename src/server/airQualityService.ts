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
const DEFAULT_FETCH_TIMEOUT_MS = 4500;
const cache = new Map<string, CachedEntry>();
const inflightRequests = new Map<string, Promise<AirQualityContext>>();

export function clearAirQualityCache(): void {
  cache.clear();
  inflightRequests.clear();
}

async function fetchJsonWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
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
  if (!options.forceRefresh) {
    const cached = cache.get(normalizedKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    const inflight = inflightRequests.get(normalizedKey);
    if (inflight) {
      return inflight;
    }
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  const lookupPromise = (async (): Promise<AirQualityContext> => {
    try {
      const geocodeUrl =
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}` +
        '&count=1&language=en&format=json';
      const rawGeo = await fetchJsonWithTimeout(geocodeUrl, fetchImpl, timeoutMs);
      const match = normalizeGeocodeMatch(rawGeo);

      if (!match) {
        return buildEstimatedScenarioContext(
          city,
          'moderate_winter_haze',
          `Could not match "${city}" in live geocoding. Showing an estimated moderate winter haze planning scenario (not live sensor data).`
        );
      }

      const aqUrl =
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${match.latitude}&longitude=${match.longitude}` +
        '&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide&timezone=auto';

      const rawAq = await fetchJsonWithTimeout(aqUrl, fetchImpl, timeoutMs);
      const context = normalizeOpenMeteoAqPayload({ match, rawAq });

      if (context.dataSource === 'live') {
        cache.set(normalizedKey, {
          context,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }

      return context;
    } catch {
      return buildEstimatedScenarioContext(
        city,
        'moderate_winter_haze',
        `Live air-quality telemetry is temporarily unreachable. Showing an estimated moderate winter haze planning scenario (not live data).`
      );
    } finally {
      inflightRequests.delete(normalizedKey);
    }
  })();

  if (!options.forceRefresh) {
    inflightRequests.set(normalizedKey, lookupPromise);
  }

  return lookupPromise;
}
