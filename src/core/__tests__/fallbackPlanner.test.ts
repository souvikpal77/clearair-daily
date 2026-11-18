import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import { buildEstimatedScenarioContext, categorizeUsAqi } from '../aqCategorizer';
import {
  buildActionChecklist,
  buildDeterministicPlan,
  buildFallbackAssistantReply,
  buildStructuredFallbackAssistantReply,
} from '../fallbackPlanner';

describe('buildDeterministicPlan', () => {
  it('adapts guidance for severe winter inversion and sensitive household', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const plan = buildDeterministicPlan(
      { ...DEFAULT_USER_PROFILE, sensitivityGroup: 'respiratory_sensitive', hasHepaFilter: true },
      aq
    );

    expect(plan.dailyPlan.length).toBeGreaterThanOrEqual(5);
    expect(plan.indoorActions.some((item) => item.area === 'Filtration')).toBe(true);
    expect(plan.cautions.some((c) => c.toLowerCase().includes('medical'))).toBe(true);
    expect(plan.indoorActions.some((i) => i.sourceType === 'evidence_based')).toBe(true);
    expect(plan.indoorActions.some((i) => i.sourceType === 'ai_personalized')).toBe(true);
  });

  it('handles normal clean day and unusual early-shift solid-fuel profile cleanly', () => {
    const cleanAq = buildEstimatedScenarioContext('Vancouver', 'clean_breeze_day');
    const normalPlan = buildDeterministicPlan(
      { ...DEFAULT_USER_PROFILE, cookingFuel: 'induction_electric', sensitivityGroup: 'general' },
      cleanAq
    );
    expect(normalPlan.dailyPlan.find((s) => s.id === 'slot-outdoor')?.priority).toBe('low');

    const missingAq = {
      ...buildEstimatedScenarioContext('Warsaw', 'moderate_winter_haze'),
      aqi: null,
      category: categorizeUsAqi(null),
    };
    const unusualPlan = buildDeterministicPlan(
      {
        ...DEFAULT_USER_PROFILE,
        workSchedule: 'early_shift',
        cookingFuel: 'solid_fuel_wood',
        ventilationType: 'windows_only',
        commuteMode: 'remote_work',
        commuteDistanceKm: 0,
      },
      missingAq
    );
    expect(unusualPlan.dailyPlan.find((s) => s.id === 'slot-commute')?.windowLabel).toBe(
      '06:00 – 08:00'
    );
    expect(
      unusualPlan.indoorActions.some((i) => i.title.toLowerCase().includes('solid-fuel'))
    ).toBe(true);
  });

  it('builds 6 checklist actions with non-empty timeWindows', () => {
    const aq = buildEstimatedScenarioContext('Toronto', 'clean_breeze_day');
    const checklist = buildActionChecklist(DEFAULT_USER_PROFILE, aq);
    expect(checklist.length).toBe(6);
    for (const item of checklist) {
      expect(item.timeWindow.length).toBeGreaterThan(0);
    }
  });
});

describe('buildFallbackAssistantReply & guardrails', () => {
  it('returns grounded commute advice referencing active city and AQI', () => {
    const aq = buildEstimatedScenarioContext('Beijing', 'moderate_winter_haze');
    const reply = buildFallbackAssistantReply(
      'How should I plan my commute today?',
      DEFAULT_USER_PROFILE,
      aq
    );
    expect(reply).toContain('Beijing');
    expect(reply).toContain('128');
    expect(reply).toContain('estimated scenario');
  });

  it('never guesses AQI when live reading is unavailable', () => {
    const missingAq = {
      ...buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze'),
      aqi: null,
      category: categorizeUsAqi(null),
    };
    const structured = buildStructuredFallbackAssistantReply(
      'What is my AQI right now?',
      DEFAULT_USER_PROFILE,
      missingAq
    );
    expect(structured.answer).toContain("don't have a reliable current AQI value");
  });

  it('enforces non-medical boundary on diagnosis or medication questions', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const structured = buildStructuredFallbackAssistantReply(
      'Should I increase my asthma inhaler dose for wheezing?',
      DEFAULT_USER_PROFILE,
      aq
    );
    expect(structured.answer.toLowerCase()).toContain('cannot diagnose');
    expect(structured.cautions[0].toLowerCase()).toContain('not medical advice'.slice(4));
  });
});
