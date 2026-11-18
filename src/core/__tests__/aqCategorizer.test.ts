import { describe, expect, it } from 'vitest';
import {
  buildEstimatedScenarioContext,
  categorizeUsAqi,
  identifyDominantPollutant,
} from '../aqCategorizer';
import type { PollutantReading } from '../../shared/types';

describe('categorizeUsAqi', () => {
  it('maps US EPA AQI boundaries accurately', () => {
    expect(categorizeUsAqi(0).level).toBe('good');
    expect(categorizeUsAqi(50).level).toBe('good');
    expect(categorizeUsAqi(51).level).toBe('moderate');
    expect(categorizeUsAqi(100).level).toBe('moderate');
    expect(categorizeUsAqi(101).level).toBe('sensitive');
    expect(categorizeUsAqi(150).level).toBe('sensitive');
    expect(categorizeUsAqi(151).level).toBe('unhealthy');
    expect(categorizeUsAqi(200).level).toBe('unhealthy');
    expect(categorizeUsAqi(201).level).toBe('very_unhealthy');
    expect(categorizeUsAqi(300).level).toBe('very_unhealthy');
    expect(categorizeUsAqi(301).level).toBe('hazardous');
  });

  it('handles null and negative AQI values gracefully as precautionary unavailable', () => {
    const nullResult = categorizeUsAqi(null);
    expect(nullResult.label).toContain('Unavailable');
    expect(categorizeUsAqi(-5).label).toContain('Unavailable');
  });
});

describe('identifyDominantPollutant', () => {
  it('identifies PM2.5 when elevated', () => {
    const readings: PollutantReading[] = [
      { code: 'PM2.5', name: 'Fine Particulate Matter', value: 72, unit: 'µg/m³', note: 'test' },
      { code: 'NO2', name: 'Nitrogen Dioxide', value: 40, unit: 'µg/m³', note: 'test' },
    ];
    expect(identifyDominantPollutant(readings)).toContain('PM2.5');
  });

  it('identifies NO2 when PM2.5 is low and NO2 is elevated', () => {
    const readings: PollutantReading[] = [
      { code: 'PM2.5', name: 'Fine Particulate Matter', value: 14, unit: 'µg/m³', note: 'test' },
      { code: 'NO2', name: 'Nitrogen Dioxide', value: 92, unit: 'µg/m³', note: 'test' },
    ];
    expect(identifyDominantPollutant(readings)).toContain('NO2');
  });
});

describe('buildEstimatedScenarioContext', () => {
  it('labels scenario estimates honestly as non-live data', () => {
    const scenario = buildEstimatedScenarioContext('Lahore', 'severe_winter_inversion');
    expect(scenario.dataSource).toBe('scenario_estimate');
    expect(scenario.confidence).toBe('estimated');
    expect(scenario.observedAt).toBeNull();
    expect(scenario.category.level).toBe('very_unhealthy');
    expect(scenario.provider.toLowerCase()).toContain('not live');
  });
});
