import { describe, expect, it } from 'vitest';
import {
  normalizeGeocodeMatch,
  normalizeOpenMeteoAqPayload,
  sanitizeBoundedMetric,
} from '../aqNormalizer';

describe('sanitizeBoundedMetric', () => {
  it('accepts valid bounded numbers and rejects NaN, Infinity, negative, or out-of-range values', () => {
    expect(sanitizeBoundedMetric(46.54, 0, 5000, 1)).toBe(46.5);
    expect(sanitizeBoundedMetric(0, 0, 1000, 0)).toBe(0);
    expect(sanitizeBoundedMetric(-3, 0, 1000, 0)).toBeNull();
    expect(sanitizeBoundedMetric(1500, 0, 1000, 0)).toBeNull();
    expect(sanitizeBoundedMetric(Number.NaN, 0, 1000, 0)).toBeNull();
    expect(sanitizeBoundedMetric(Number.POSITIVE_INFINITY, 0, 1000, 0)).toBeNull();
  });
});

describe('normalizeGeocodeMatch', () => {
  it('validates coordinates and rejects invalid response shapes', () => {
    expect(
      normalizeGeocodeMatch({
        results: [{ name: 'Warsaw', country: 'Poland', latitude: 52.23, longitude: 21.01 }],
      })?.name
    ).toBe('Warsaw');

    expect(
      normalizeGeocodeMatch({
        results: [{ name: 'BadCoords', latitude: 200, longitude: 21.01 }],
      })
    ).toBeNull();

    expect(normalizeGeocodeMatch({ unexpected: true })).toBeNull();
  });
});

describe('normalizeOpenMeteoAqPayload', () => {
  const sampleMatch = {
    name: 'Warsaw',
    country: 'Poland',
    admin1: 'Masovia',
    latitude: 52.23,
    longitude: 21.01,
  };

  it('normalizes valid AQ data and preserves external category when supplied', () => {
    const res = normalizeOpenMeteoAqPayload({
      match: sampleMatch,
      rawAq: {
        current: {
          time: '2026-11-18T12:00',
          us_aqi: 162,
          pm2_5: 76.4,
          pm10: 112.2,
          nitrogen_dioxide: 48.1,
          ozone: 29.5,
          category: 'Provider: Unhealthy',
        },
      },
    });

    expect(res.dataSource).toBe('live');
    expect(res.confidence).toBe('high');
    expect(res.aqi).toBe(162);
    expect(res.category.level).toBe('unhealthy');
    expect(res.externalCategory).toEqual({
      providerLabel: 'Provider: Unhealthy',
      source: 'Open-Meteo Air Quality API',
    });
  });

  it('handles missing AQI value while preserving valid pollutant readings as precautionary', () => {
    const res = normalizeOpenMeteoAqPayload({
      match: sampleMatch,
      rawAq: {
        current: {
          time: '2026-11-18T12:00',
          us_aqi: null,
          pm2_5: 42.1,
          pm10: null,
        },
      },
    });

    expect(res.aqi).toBeNull();
    expect(res.category.label).toContain('Unavailable');
    expect(res.dataSource).toBe('scenario_estimate');
    expect(res.pollutants.find((p) => p.code === 'PM2.5')?.value).toBe(42.1);
  });

  it('returns controlled fallback when all upstream readings are impossible or malformed', () => {
    const res = normalizeOpenMeteoAqPayload({
      match: sampleMatch,
      rawAq: {
        current: {
          us_aqi: 99999,
          pm2_5: -50,
          pm10: 80000,
          nitrogen_dioxide: null,
          ozone: null,
        },
      },
    });

    expect(res.dataSource).toBe('scenario_estimate');
    expect(res.confidence).toBe('estimated');
    expect(res.statusNote.toLowerCase()).toContain('bounds');
  });
});
