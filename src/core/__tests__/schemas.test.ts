import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import {
  AiPlanPayloadSchema,
  AssistantChatRequestSchema,
  UserProfileSchema,
} from '../../shared/schemas';
import { buildEstimatedScenarioContext } from '../aqCategorizer';
import { buildDeterministicPlan } from '../fallbackPlanner';

describe('UserProfileSchema', () => {
  it('validates and strips control characters from city input', () => {
    const parsed = UserProfileSchema.parse({
      ...DEFAULT_USER_PROFILE,
      city: '  New\u0000 Delhi \n ',
    });
    expect(parsed.city).toBe('New Delhi');
  });

  it('rejects out-of-range householdSize and commuteDistanceKm', () => {
    const invalid = UserProfileSchema.safeParse({
      ...DEFAULT_USER_PROFILE,
      householdSize: 0,
      commuteDistanceKm: 500,
    });
    expect(invalid.success).toBe(false);
  });
});

describe('AiPlanPayloadSchema', () => {
  it('validates deterministic fallback plan structure completely', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const plan = buildDeterministicPlan(DEFAULT_USER_PROFILE, aq);
    const result = AiPlanPayloadSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('rejects malformed or incomplete AI payloads', () => {
    const malformed = AiPlanPayloadSchema.safeParse({
      summary: 'Too short',
      priorities: [],
    });
    expect(malformed.success).toBe(false);
  });
});

describe('AssistantChatRequestSchema', () => {
  it('rejects empty questions or overly long chat questions', () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze');
    const empty = AssistantChatRequestSchema.safeParse({
      question: ' ',
      profile: DEFAULT_USER_PROFILE,
      airQuality: aq,
    });
    expect(empty.success).toBe(false);

    const tooLong = AssistantChatRequestSchema.safeParse({
      question: 'a'.repeat(700),
      profile: DEFAULT_USER_PROFILE,
      airQuality: aq,
    });
    expect(tooLong.success).toBe(false);
  });
});
