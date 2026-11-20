import { z } from 'zod';
import type { AirQualityContext, PollutantReading } from '../shared/types.ts';
import {
  buildEstimatedScenarioContext,
  categorizeUsAqi,
  identifyDominantPollutant,
  US_EPA_AQI_THRESHOLDS,
} from './aqCategorizer.ts';

export const EXTERNAL_PHYSICAL_BOUNDS = {
  aqiMin: 0,
  aqiMax: US_EPA_AQI_THRESHOLDS.maxValidAqi,
  pollutantMinUgM3: 0,
  pollutantMaxUgM3: 5000,
} as const;

export const GeocodeResultSchema = z.object({
  name: z.string().min(1).max(120),
  country: z.string().max(100).optional(),
  admin1: z.string().max(100).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export const GeocodeResponseSchema = z.object({
  results: z.array(GeocodeResultSchema).optional(),
});

export const OpenMeteoCurrentSchema = z.object({
  time: z.string().max(64).optional(),
  us_aqi: z.number().nullable().optional(),
  pm2_5: z.number().nullable().optional(),
  pm10: z.number().nullable().optional(),
  nitrogen_dioxide: z.number().nullable().optional(),
  ozone: z.number().nullable().optional(),
  sulphur_dioxide: z.number().nullable().optional(),
  carbon_monoxide: z.number().nullable().optional(),
  category: z.string().max(80).optional(),
});

export const OpenMeteoAqResponseSchema = z.object({
  current: OpenMeteoCurrentSchema.optional(),
});

export type GeocodeMatch = z.infer<typeof GeocodeResultSchema>;

export function sanitizeBoundedMetric(
  rawValue: unknown,
  min: number,
  max: number,
  decimals: number
): number | null {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return null;
  }
  if (rawValue < min || rawValue > max) {
    return null;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(rawValue * factor) / factor;
}

export function normalizeGeocodeMatch(rawGeo: unknown): GeocodeMatch | null {
  const parsed = GeocodeResponseSchema.safeParse(rawGeo);
  if (!parsed.success || !parsed.data.results || parsed.data.results.length === 0) {
    return null;
  }
  return parsed.data.results[0];
}

export function normalizeOpenMeteoAqPayload(params: {
  match: GeocodeMatch;
  rawAq: unknown;
}): AirQualityContext {
  const { match, rawAq } = params;
  const parsedAq = OpenMeteoAqResponseSchema.safeParse(rawAq);

  if (!parsedAq.success || !parsedAq.data.current) {
    return buildEstimatedScenarioContext(
      match.name,
      'moderate_winter_haze',
      `Live telemetry for ${match.name} returned an unexpected or incomplete structure. Showing an estimated planning scenario instead of live readings.`
    );
  }

  const current = parsedAq.data.current;
  const aqiValue = sanitizeBoundedMetric(
    current.us_aqi,
    EXTERNAL_PHYSICAL_BOUNDS.aqiMin,
    EXTERNAL_PHYSICAL_BOUNDS.aqiMax,
    0
  );

  const pm25 = sanitizeBoundedMetric(
    current.pm2_5,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMinUgM3,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMaxUgM3,
    1
  );
  const pm10 = sanitizeBoundedMetric(
    current.pm10,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMinUgM3,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMaxUgM3,
    1
  );
  const no2 = sanitizeBoundedMetric(
    current.nitrogen_dioxide,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMinUgM3,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMaxUgM3,
    1
  );
  const o3 = sanitizeBoundedMetric(
    current.ozone,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMinUgM3,
    EXTERNAL_PHYSICAL_BOUNDS.pollutantMaxUgM3,
    1
  );

  const hasAnyValidReading =
    aqiValue !== null || pm25 !== null || pm10 !== null || no2 !== null || o3 !== null;

  if (!hasAnyValidReading) {
    return buildEstimatedScenarioContext(
      match.name,
      'moderate_winter_haze',
      `Upstream readings for ${match.name} were missing or outside valid physical bounds. Showing an estimated planning scenario instead of live readings.`
    );
  }

  const pollutants: PollutantReading[] = [
    {
      code: 'PM2.5',
      name: 'Fine Particulate Matter',
      value: pm25,
      unit: 'µg/m³',
      note: 'Combustion & winter smog fine particles',
    },
    {
      code: 'PM10',
      name: 'Coarse Particulate Matter',
      value: pm10,
      unit: 'µg/m³',
      note: 'Road dust & suspended particulates',
    },
    {
      code: 'NO2',
      name: 'Nitrogen Dioxide',
      value: no2,
      unit: 'µg/m³',
      note: 'Traffic & gas-burning indicator',
    },
    {
      code: 'O3',
      name: 'Ground-Level Ozone',
      value: o3,
      unit: 'µg/m³',
      note: 'Secondary photochemical oxidant',
    },
  ];

  const regionParts = [match.admin1, match.country].filter(Boolean);
  const trimmedExtCategory = current.category?.trim();

  return {
    cityResolved: match.name,
    countryOrRegion: regionParts.join(', ') || 'Resolved Location',
    latitude: null,
    longitude: null,
    aqi: aqiValue,
    category: categorizeUsAqi(aqiValue),
    ...(trimmedExtCategory
      ? {
          externalCategory: {
            providerLabel: trimmedExtCategory,
            source: 'Open-Meteo Air Quality API',
          },
        }
      : {}),
    dominantPollutant: identifyDominantPollutant(pollutants),
    pollutants,
    observedAt: current.time?.trim() || null,
    dataSource: aqiValue !== null ? 'live' : 'scenario_estimate',
    provider: 'Open-Meteo Air Quality API',
    confidence: aqiValue !== null ? 'high' : 'estimated',
    statusNote:
      aqiValue !== null
        ? 'Live regional air-quality model & station blend from Open-Meteo. Local street-level conditions near busy roads may be higher.'
        : 'Location matched, but current US AQI value was unavailable or invalid from upstream.',
    scenarioId: 'live',
  };
}
