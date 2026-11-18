import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import { buildEstimatedScenarioContext } from '../aqCategorizer';
import { buildTodaysAirSignals, formatDataFreshness } from '../formatters';

describe('formatDataFreshness', () => {
  it('never implies live data for estimated planning scenarios', () => {
    const res = formatDataFreshness('2026-11-18T12:00:00Z', 'scenario_estimate');
    expect(res.isLive).toBe(false);
    expect(res.label.toLowerCase()).toContain('estimated');
    expect(res.detail.toLowerCase()).toContain('not live');
  });

  it('formats recent live timestamps into human-friendly relative minutes', () => {
    const now = new Date('2026-11-18T12:56:00Z');
    const observed = '2026-11-18T12:00:00Z';
    const res = formatDataFreshness(observed, 'live', now);
    expect(res.isLive).toBe(true);
    expect(res.label).toBe('Updated 56 min ago');
  });

  it('formats just-now and multi-hour live timestamps cleanly', () => {
    const now = new Date('2026-11-18T15:00:00Z');
    expect(formatDataFreshness('2026-11-18T14:59:30Z', 'live', now).label).toBe(
      'Updated just now'
    );
    expect(formatDataFreshness('2026-11-18T12:00:00Z', 'live', now).label).toBe(
      'Updated 3 hrs ago'
    );
  });
});

describe('buildTodaysAirSignals', () => {
  it('produces three distinct accessible air signals for severe winter inversion', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const signals = buildTodaysAirSignals(aq, DEFAULT_USER_PROFILE);
    expect(signals).toHaveLength(3);
    expect(signals[0].statusLevel).toBe('alert');
    expect(signals[0].actionLabel).toContain('Reduce outdoor exposure');
    expect(signals[2].actionLabel).toContain('Prefer lower-emission travel');
  });

  it('produces positive outdoor signal on clean breeze days', () => {
    const aq = buildEstimatedScenarioContext('Vancouver', 'clean_breeze_day');
    const signals = buildTodaysAirSignals(aq, DEFAULT_USER_PROFILE);
    expect(signals[0].statusLevel).toBe('positive');
  });
});
