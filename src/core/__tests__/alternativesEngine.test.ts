import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import { buildDeterministicAlternatives, isActiveCommutePractical } from '../alternativesEngine';
import { buildEstimatedScenarioContext, categorizeUsAqi } from '../aqCategorizer';

describe('isActiveCommutePractical', () => {
  it('blocks automatic walk/cycle recommendations when pollution is severe or distance is long', () => {
    const severeAq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    expect(
      isActiveCommutePractical({ ...DEFAULT_USER_PROFILE, commuteDistanceKm: 2 }, severeAq)
        .practical
    ).toBe(false);

    const cleanAq = buildEstimatedScenarioContext('Oslo', 'clean_breeze_day');
    expect(
      isActiveCommutePractical({ ...DEFAULT_USER_PROFILE, commuteDistanceKm: 12 }, cleanAq)
        .practical
    ).toBe(false);
    expect(
      isActiveCommutePractical(
        { ...DEFAULT_USER_PROFILE, commuteDistanceKm: 3, sensitivityGroup: 'general' },
        cleanAq
      ).practical
    ).toBe(true);
  });

  it('disallows active commute advice for sensitive groups during sensitive/missing AQI', () => {
    const sensitiveAq = buildEstimatedScenarioContext('Milan', 'moderate_winter_haze');
    const res = isActiveCommutePractical(
      { ...DEFAULT_USER_PROFILE, commuteDistanceKm: 3, sensitivityGroup: 'respiratory_sensitive' },
      sensitiveAq
    );
    expect(res.practical).toBe(false);
  });
});

describe('buildDeterministicAlternatives', () => {
  it('recommends transit or carpool for car_solo commute and never active travel in severe smog', () => {
    const severeAq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const alts = buildDeterministicAlternatives(
      { ...DEFAULT_USER_PROFILE, commuteMode: 'car_solo', commuteDistanceKm: 4 },
      severeAq
    );
    const commuteAlt = alts.find((a) => a.domain === 'Daily Commute');
    expect(commuteAlt?.alternativeChoice.toLowerCase()).toContain('public transit');
    expect(commuteAlt?.alternativeChoice.toLowerCase()).not.toContain('walk or cycle');
  });

  it('suggests shifting walk_cycle to covered transit during unhealthy air', () => {
    const unhealthyAq = {
      ...buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze'),
      aqi: 185,
      category: categorizeUsAqi(185),
    };
    const alts = buildDeterministicAlternatives(
      { ...DEFAULT_USER_PROFILE, commuteMode: 'walk_cycle', commuteDistanceKm: 4 },
      unhealthyAq
    );
    expect(alts[0].domain).toBe('High-Smog Commute Shift');
    expect(alts[0].alternativeChoice.toLowerCase()).toContain('covered public transit');
  });

  it('suggests errand consolidation for public_transit / remote_work profiles', () => {
    const cleanAq = buildEstimatedScenarioContext('Tokyo', 'clean_breeze_day');
    const alts = buildDeterministicAlternatives(
      { ...DEFAULT_USER_PROFILE, commuteMode: 'public_transit', commuteDistanceKm: 8 },
      cleanAq
    );
    expect(alts.some((a) => a.domain === 'Household Errands')).toBe(true);
    expect(alts.every((a) => a.tradeOffs.length > 5 && a.whenNotSuitable.length > 5)).toBe(true);
  });
});
