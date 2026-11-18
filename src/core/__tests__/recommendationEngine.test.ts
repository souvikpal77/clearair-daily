import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import { buildEstimatedScenarioContext, categorizeUsAqi } from '../aqCategorizer';
import {
  buildDeterministicRecommendations,
  getPriorityWeight,
} from '../recommendationEngine';

describe('buildDeterministicRecommendations', () => {
  it('prioritizes critical exposure & protection actions under severe winter smog', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const recs = buildDeterministicRecommendations(
      { ...DEFAULT_USER_PROFILE, sensitivityGroup: 'respiratory_sensitive', hasHepaFilter: true },
      aq,
      { currentHour: 8 }
    );

    expect(recs[0].priority).toBe('critical');
    expect(recs.some((r) => r.category === 'exposure' && r.priority === 'critical')).toBe(true);
    expect(recs.some((r) => r.category === 'protection' && r.priority === 'critical')).toBe(true);

    // Ensure strict non-increasing priority order
    for (let i = 1; i < recs.length; i++) {
      expect(getPriorityWeight(recs[i - 1].priority)).toBeGreaterThanOrEqual(
        getPriorityWeight(recs[i].priority)
      );
    }
  });

  it('keeps routine low/medium priorities on clean breeze days with electric cooking', () => {
    const aq = buildEstimatedScenarioContext('Zurich', 'clean_breeze_day');
    const recs = buildDeterministicRecommendations(
      {
        ...DEFAULT_USER_PROFILE,
        commuteMode: 'public_transit',
        cookingFuel: 'induction_electric',
        sensitivityGroup: 'general',
        hasHepaFilter: false,
      },
      aq,
      { currentHour: 14 }
    );

    expect(recs.every((r) => r.priority === 'low' || r.priority === 'medium')).toBe(true);
    expect(recs).toContainEqual(
      expect.objectContaining({
        category: 'transport',
        sourceType: 'deterministic_rule',
      })
    );
  });

  it('flags solid-fuel indoor burning as critical even during moderate outdoor air', () => {
    const aq = buildEstimatedScenarioContext('Krakow', 'moderate_winter_haze');
    const recs = buildDeterministicRecommendations(
      {
        ...DEFAULT_USER_PROFILE,
        cookingFuel: 'solid_fuel_wood',
        ventilationType: 'windows_only',
      },
      aq,
      { currentHour: 19 }
    );

    const indoor = recs.find((r) => r.category === 'indoor');
    expect(indoor?.priority).toBe('critical');
    expect(indoor?.title.toLowerCase()).toContain('solid-fuel');
  });

  it('adapts active walk/cycle commute under unhealthy air and includes mechanism and limitations', () => {
    const aq = {
      ...buildEstimatedScenarioContext('Lahore', 'moderate_winter_haze'),
      aqi: 175,
      category: categorizeUsAqi(175),
    };
    const recs = buildDeterministicRecommendations(
      {
        ...DEFAULT_USER_PROFILE,
        commuteMode: 'walk_cycle',
        outdoorHabit: 'daily_exercise',
      },
      aq,
      { currentHour: 8 }
    );

    const transport = recs.find((r) => r.category === 'transport');
    expect(transport?.priority).toBe('high');
    expect(transport?.action.toLowerCase()).toContain('covered transit');
    expect(transport?.mechanism.length).toBeGreaterThan(15);
    expect(transport?.limitations.length).toBeGreaterThan(15);
  });

  it('uses precautionary high-priority outdoor guidance when live AQI is unavailable', () => {
    const missingAq = {
      ...buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze'),
      aqi: null,
      category: categorizeUsAqi(null),
    };
    const recs = buildDeterministicRecommendations(DEFAULT_USER_PROFILE, missingAq);
    const exposure = recs.find((r) => r.category === 'exposure');
    expect(exposure?.priority).toBe('high');
    expect(exposure?.reason.toLowerCase()).toContain('unavailable');
  });
});
