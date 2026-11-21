import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import { buildDeterministicAlternatives } from '../alternativesEngine';
import { buildEstimatedScenarioContext } from '../aqCategorizer';
import {
  buildDeterministicImpactChains,
  calculateActivityImpact,
  calculateCommunityProjection,
  calculateTransportImpact,
  calculateTripReduction,
  estimateWeeklyTripReductionRange,
} from '../impactCalculator';

describe('estimateWeeklyTripReductionRange', () => {
  it('computes round-trip km and bounded emission savings ranges', () => {
    const res = estimateWeeklyTripReductionRange(10, 2);
    expect(res.kmReduced).toBe(40);
    expect(res.soloCarCo2Range[0]).toBeLessThan(res.soloCarCo2Range[1]);
    expect(res.transitNetSavingsRange[0]).toBeGreaterThan(0);
    expect(res.transitNetSavingsRange[1]).toBeLessThanOrEqual(res.soloCarCo2Range[1]);
  });

  it('clamps negative, zero, NaN, and extreme inputs safely', () => {
    const zero = estimateWeeklyTripReductionRange(-10, 2);
    expect(zero.kmReduced).toBe(0);
    expect(zero.transitNetSavingsRange).toEqual([0, 0]);

    const nanRes = estimateWeeklyTripReductionRange(Number.NaN, 2);
    expect(nanRes.kmReduced).toBe(0);
    expect(nanRes.soloCarCo2Range).toEqual([0, 0]);

    const extremeRes = estimateWeeklyTripReductionRange(9999, 50);
    expect(extremeRes.kmReduced).toBe(150 * 2 * 14);
  });
});

describe('calculateTransportImpact & calculateTripReduction & calculateActivityImpact', () => {
  it('computes zero solo-car km reduction for remote_work and non-driving modes', () => {
    const remote = calculateTransportImpact({
      commuteMode: 'remote_work',
      commuteDistanceKm: 15,
      tripsReplacedPerWeek: 2,
    });
    expect(remote.kmReduced).toBe(0);
    expect(remote.netCo2SavedRange).toEqual([0, 0]);

    const transit = calculateTransportImpact({
      commuteMode: 'public_transit',
      commuteDistanceKm: 12,
      tripsReplacedPerWeek: 2,
    });
    expect(transit.kmReduced).toBe(0);
    expect(transit.limitations.length).toBeGreaterThan(10);
  });

  it('calculates errand trip consolidation without inventing CO2 percentages', () => {
    const res = calculateTripReduction({
      averageTripDistanceKm: 5,
      separateTripsPerWeek: 4,
      consolidatedTripsPerWeek: 1,
    });
    expect(res.tripsEliminatedPerWeek).toBe(3);
    expect(res.coldStartsAvoided).toBe(3);
    expect(res.limitations.length).toBeGreaterThan(10);
  });

  it('handles missing/invalid AQI and elevated AQI in calculateActivityImpact', () => {
    const missing = calculateActivityImpact({
      outdoorHabit: 'daily_exercise',
      aqi: null,
      sensitivityGroup: 'general',
    });
    expect(missing.exposureRiskTier).toBe('precautionary');

    const elevated = calculateActivityImpact({
      outdoorHabit: 'daily_exercise',
      aqi: 165,
      sensitivityGroup: 'respiratory_sensitive',
    });
    expect(elevated.exposureRiskTier).toBe('elevated');
    expect(elevated.recommendedAction.toLowerCase()).toContain('indoors');
  });
});

describe('buildDeterministicImpactChains', () => {
  it('creates Action -> Mechanism -> Direct Impact chains with explicit assumptions and limitations', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const chains = buildDeterministicImpactChains(DEFAULT_USER_PROFILE, aq);
    expect(chains.length).toBeGreaterThanOrEqual(3);
    for (const chain of chains) {
      expect(chain.action.length).toBeGreaterThan(10);
      expect(chain.mechanism.length).toBeGreaterThan(10);
      expect(chain.directImpact.length).toBeGreaterThan(10);
      expect(chain.assumptions.length).toBeGreaterThan(10);
      expect((chain.limitations ?? '').length).toBeGreaterThan(10);
    }
  });
});

describe('buildDeterministicAlternatives', () => {
  it('always documents trade-offs and when-not-suitable conditions', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze');
    const alts = buildDeterministicAlternatives(DEFAULT_USER_PROFILE, aq);
    expect(alts.length).toBeGreaterThanOrEqual(3);
    for (const alt of alts) {
      expect(alt.tradeOffs.length).toBeGreaterThan(5);
      expect(alt.whenNotSuitable.length).toBeGreaterThan(5);
    }
  });
});

describe('calculateCommunityProjection', () => {
  it('scales linearly and includes clear methodology assumptions', () => {
    const one = calculateCommunityProjection(DEFAULT_USER_PROFILE, 1, 2);
    const hundred = calculateCommunityProjection(DEFAULT_USER_PROFILE, 100, 2);
    expect(hundred.collectiveEstimatedKmReduced).toBe(one.individualEstimatedKmReduced * 100);
    expect(hundred.methodologyNote).toContain('100 households');
    expect(hundred.methodologyNote).toContain('not a city-wide ambient AQI forecast');
  });
});
