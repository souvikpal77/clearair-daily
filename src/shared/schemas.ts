import { z } from 'zod';
import { MAX_VALID_AQI } from './constants.ts';

const sanitizePlainText = (value: string): string =>
  value
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const UNSAFE_HTML_MARKUP_REGEX =
  /<\s*\/?\s*(script|iframe|object|embed|style|svg|img|link|meta|base|form)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]+\s*=/i;

export const SafeShortTextSchema = (minLen: number, maxLen: number) =>
  z
    .string()
    .transform(sanitizePlainText)
    .pipe(z.string().min(minLen).max(maxLen));

export const SafeAiTextSchema = (minLen: number, maxLen: number) =>
  SafeShortTextSchema(minLen, maxLen).refine(
    (value) => !UNSAFE_HTML_MARKUP_REGEX.test(value),
    'Unsafe markup is not permitted in generated output'
  );

export const CommuteModeSchema = z.enum([
  'car_solo',
  'carpool',
  'public_transit',
  'walk_cycle',
  'remote_work',
]);

export const WorkScheduleSchema = z.enum([
  'standard_9_to_5',
  'early_shift',
  'flexible_hybrid',
  'home_based',
]);

export const OutdoorHabitSchema = z.enum([
  'daily_exercise',
  'short_walks',
  'mostly_indoors',
]);

export const CookingFuelSchema = z.enum([
  'gas_stove',
  'induction_electric',
  'solid_fuel_wood',
]);

export const VentilationTypeSchema = z.enum([
  'windows_only',
  'exhaust_hood',
  'mechanical_hvac',
]);

export const SensitivityGroupSchema = z.enum([
  'general',
  'children_elderly',
  'respiratory_sensitive',
]);

export const PlanningScenarioIdSchema = z.enum([
  'live',
  'moderate_winter_haze',
  'severe_winter_inversion',
  'clean_breeze_day',
]);

export const UserProfileSchema = z.object({
  city: SafeShortTextSchema(2, 80),
  householdSize: z.number().int().min(1).max(15),
  commuteMode: CommuteModeSchema,
  commuteDistanceKm: z.number().finite().min(0).max(150),
  workSchedule: WorkScheduleSchema,
  outdoorHabit: OutdoorHabitSchema,
  cookingFuel: CookingFuelSchema,
  ventilationType: VentilationTypeSchema,
  hasHepaFilter: z.boolean(),
  sensitivityGroup: SensitivityGroupSchema,
});

export const AirQualityQuerySchema = z
  .object({
    city: SafeShortTextSchema(2, 80),
    scenario: PlanningScenarioIdSchema.optional().default('live'),
    refresh: z.enum(['true', 'false']).optional().default('false'),
  })
  .strict();

export const ChecklistStorageSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ids: z.array(SafeShortTextSchema(1, 64)).max(20),
});

export const AqCategoryInfoSchema = z.object({
  level: z.enum(['good', 'moderate', 'sensitive', 'unhealthy', 'very_unhealthy', 'hazardous']),
  label: SafeShortTextSchema(2, 60),
  shortGuidance: SafeShortTextSchema(5, 240),
  badgeTone: z.enum(['green', 'amber', 'orange', 'red', 'purple']),
  outdoorMultiplier: SafeShortTextSchema(2, 120),
});

export const PollutantReadingSchema = z.object({
  code: z.enum(['PM2.5', 'PM10', 'NO2', 'O3', 'SO2', 'CO']),
  name: SafeShortTextSchema(2, 60),
  value: z.number().finite().min(0).max(50000).nullable(),
  unit: SafeShortTextSchema(1, 20),
  note: SafeShortTextSchema(2, 160),
});

export const AirQualityContextSchema = z.object({
  cityResolved: SafeShortTextSchema(2, 100),
  countryOrRegion: SafeShortTextSchema(1, 100),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  aqi: z.number().finite().min(0).max(MAX_VALID_AQI).nullable(),
  category: AqCategoryInfoSchema,
  externalCategory: z
    .object({
      providerLabel: SafeShortTextSchema(1, 80),
      source: SafeShortTextSchema(1, 100),
    })
    .optional(),
  dominantPollutant: SafeShortTextSchema(2, 60),
  pollutants: z.array(PollutantReadingSchema).max(10),
  observedAt: z.string().max(64).nullable(),
  dataSource: z.enum(['live', 'scenario_estimate']),
  provider: SafeShortTextSchema(2, 100),
  confidence: z.enum(['high', 'estimated']),
  statusNote: SafeShortTextSchema(5, 320),
  scenarioId: PlanningScenarioIdSchema,
});

export const PlanTimeSlotSchema = z.object({
  id: SafeAiTextSchema(1, 40),
  windowLabel: SafeAiTextSchema(2, 40),
  title: SafeAiTextSchema(3, 100),
  guidance: SafeAiTextSchema(8, 360),
  priority: z.enum(['high', 'moderate', 'low']),
  avoidOrReduce: SafeAiTextSchema(3, 220).optional(),
  context: z.enum(['indoor', 'outdoor', 'commute', 'mixed']).optional(),
  reason: SafeAiTextSchema(5, 240).optional(),
});

export const ImpactChainSchema = z.object({
  id: SafeAiTextSchema(1, 40),
  title: SafeAiTextSchema(3, 100),
  action: SafeAiTextSchema(5, 180),
  mechanism: SafeAiTextSchema(5, 180),
  directImpact: SafeAiTextSchema(5, 220),
  estimatedRangeLabel: SafeAiTextSchema(3, 140),
  assumptions: SafeAiTextSchema(5, 260),
  limitations: SafeAiTextSchema(5, 260).optional(),
  category: z.enum(['mobility', 'indoor', 'exposure', 'energy']),
});

export const IndoorGuidanceItemSchema = z.object({
  id: SafeAiTextSchema(1, 40),
  area: z.enum(['Ventilation', 'Cooking', 'Filtration', 'Combustion', 'Living Space']),
  title: SafeAiTextSchema(3, 100),
  guidance: SafeAiTextSchema(8, 340),
  sourceType: z.enum(['evidence_based', 'ai_personalized']),
  rationale: SafeAiTextSchema(5, 260),
  limitations: SafeAiTextSchema(5, 240).optional(),
});

export const AlternativeComparisonSchema = z.object({
  id: SafeAiTextSchema(1, 40),
  domain: SafeAiTextSchema(2, 60),
  currentChoice: SafeAiTextSchema(3, 140),
  alternativeChoice: SafeAiTextSchema(3, 160),
  practicality: z.enum(['High', 'Moderate', 'Situational']),
  environmentalReasoning: SafeAiTextSchema(5, 260),
  estimatedImpact: SafeAiTextSchema(4, 180),
  assumptions: SafeAiTextSchema(4, 240),
  tradeOffs: SafeAiTextSchema(4, 240),
  whenNotSuitable: SafeAiTextSchema(4, 240),
});

export const AiPlanPayloadSchema = z.object({
  summary: SafeAiTextSchema(10, 420),
  priorities: z.array(SafeAiTextSchema(5, 180)).min(2).max(6),
  dailyPlan: z.array(PlanTimeSlotSchema).min(4).max(7),
  indoorActions: z.array(IndoorGuidanceItemSchema).min(3).max(7),
  lowEmissionAlternatives: z.array(AlternativeComparisonSchema).min(2).max(5),
  impactExplanations: z.array(ImpactChainSchema).min(2).max(5),
  cautions: z.array(SafeAiTextSchema(5, 240)).min(1).max(5),
});

export const StructuredAssistantReplySchema = z.object({
  answer: SafeAiTextSchema(10, 900),
  recommendations: z.array(SafeAiTextSchema(5, 220)).max(5),
  impactExplanation: SafeAiTextSchema(8, 340),
  cautions: z.array(SafeAiTextSchema(5, 240)).min(1).max(4),
});

export const GeneratePlanRequestSchema = z
  .object({
    profile: UserProfileSchema,
    airQuality: AirQualityContextSchema,
  })
  .strict();

export const AssistantChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: SafeShortTextSchema(1, 1200),
});

export const AssistantChatRequestSchema = z
  .object({
    question: SafeShortTextSchema(2, 600),
    history: z.array(AssistantChatTurnSchema).max(10).optional().default([]),
    profile: UserProfileSchema,
    airQuality: AirQualityContextSchema,
    planSummary: SafeShortTextSchema(5, 500).optional(),
  })
  .strict();

export const ActionChecklistItemSchema = z.object({
  id: SafeShortTextSchema(1, 64),
  label: SafeShortTextSchema(2, 240),
  category: z.enum(['exposure', 'emissions', 'indoor']),
  timeWindow: SafeShortTextSchema(1, 40),
});

export const StructuredRecommendationSchema = z.object({
  id: SafeShortTextSchema(1, 64),
  category: z.enum(['exposure', 'transport', 'indoor', 'energy', 'protection']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  title: SafeShortTextSchema(2, 120),
  action: SafeShortTextSchema(2, 320),
  reason: SafeShortTextSchema(2, 320),
  mechanism: SafeShortTextSchema(2, 320),
  impact: SafeShortTextSchema(2, 240),
  limitations: SafeShortTextSchema(2, 320),
  sourceType: z.enum(['deterministic_rule', 'ai_personalized']),
  targetSection: z.enum(['daily-plan', 'indoor-air', 'alternatives']),
});

export const GeneratedAirPlanResponseSchema = z.object({
  plan: AiPlanPayloadSchema,
  recommendations: z.array(StructuredRecommendationSchema).optional(),
  checklist: z.array(ActionChecklistItemSchema).max(20),
  generationMode: z.enum(['gemini_personalized', 'deterministic_fallback']),
  fallbackNotice: SafeShortTextSchema(1, 300).nullable(),
  generatedAt: z.string().min(1).max(64),
  disclaimer: SafeShortTextSchema(5, 400),
});

export const AssistantChatResponseSchema = z.object({
  reply: SafeShortTextSchema(2, 2500),
  structuredReply: StructuredAssistantReplySchema.optional(),
  mode: z.enum(['gemini_grounded', 'deterministic_fallback']),
  groundedContextSummary: SafeShortTextSchema(2, 240),
  disclaimer: SafeShortTextSchema(5, 400),
});
