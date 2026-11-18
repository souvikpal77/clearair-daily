import { z } from 'zod';

const sanitizePlainText = (value: string): string =>
  value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const SafeShortTextSchema = (minLen: number, maxLen: number) =>
  z
    .string()
    .transform(sanitizePlainText)
    .pipe(z.string().min(minLen).max(maxLen));

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

export const AirQualityQuerySchema = z.object({
  city: SafeShortTextSchema(2, 80),
  scenario: PlanningScenarioIdSchema.optional().default('live'),
  refresh: z.enum(['true', 'false']).optional().default('false'),
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
  aqi: z.number().finite().min(0).max(1000).nullable(),
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
  id: SafeShortTextSchema(1, 40),
  windowLabel: SafeShortTextSchema(2, 40),
  title: SafeShortTextSchema(3, 100),
  guidance: SafeShortTextSchema(8, 360),
  priority: z.enum(['high', 'moderate', 'low']),
  avoidOrReduce: SafeShortTextSchema(3, 220).optional(),
  context: z.enum(['indoor', 'outdoor', 'commute', 'mixed']).optional(),
  reason: SafeShortTextSchema(5, 240).optional(),
});

export const ImpactChainSchema = z.object({
  id: SafeShortTextSchema(1, 40),
  title: SafeShortTextSchema(3, 100),
  action: SafeShortTextSchema(5, 180),
  mechanism: SafeShortTextSchema(5, 180),
  directImpact: SafeShortTextSchema(5, 220),
  estimatedRangeLabel: SafeShortTextSchema(3, 140),
  assumptions: SafeShortTextSchema(5, 260),
  limitations: SafeShortTextSchema(5, 260).optional(),
  category: z.enum(['mobility', 'indoor', 'exposure', 'energy']),
});

export const IndoorGuidanceItemSchema = z.object({
  id: SafeShortTextSchema(1, 40),
  area: z.enum(['Ventilation', 'Cooking', 'Filtration', 'Combustion', 'Living Space']),
  title: SafeShortTextSchema(3, 100),
  guidance: SafeShortTextSchema(8, 340),
  sourceType: z.enum(['evidence_based', 'ai_personalized']),
  rationale: SafeShortTextSchema(5, 260),
  limitations: SafeShortTextSchema(5, 240).optional(),
});

export const AlternativeComparisonSchema = z.object({
  id: SafeShortTextSchema(1, 40),
  domain: SafeShortTextSchema(2, 60),
  currentChoice: SafeShortTextSchema(3, 140),
  alternativeChoice: SafeShortTextSchema(3, 160),
  practicality: z.enum(['High', 'Moderate', 'Situational']),
  environmentalReasoning: SafeShortTextSchema(5, 260),
  estimatedImpact: SafeShortTextSchema(4, 180),
  assumptions: SafeShortTextSchema(4, 240),
  tradeOffs: SafeShortTextSchema(4, 240),
  whenNotSuitable: SafeShortTextSchema(4, 240),
});

export const AiPlanPayloadSchema = z.object({
  summary: SafeShortTextSchema(10, 420),
  priorities: z.array(SafeShortTextSchema(5, 180)).min(2).max(6),
  dailyPlan: z.array(PlanTimeSlotSchema).min(4).max(7),
  indoorActions: z.array(IndoorGuidanceItemSchema).min(3).max(7),
  lowEmissionAlternatives: z.array(AlternativeComparisonSchema).min(2).max(5),
  impactExplanations: z.array(ImpactChainSchema).min(2).max(5),
  cautions: z.array(SafeShortTextSchema(5, 240)).min(1).max(5),
});

export const StructuredAssistantReplySchema = z.object({
  answer: SafeShortTextSchema(10, 900),
  recommendations: z.array(SafeShortTextSchema(5, 220)).max(5),
  impactExplanation: SafeShortTextSchema(8, 340),
  cautions: z.array(SafeShortTextSchema(5, 240)).min(1).max(4),
});

export const GeneratePlanRequestSchema = z.object({
  profile: UserProfileSchema,
  airQuality: AirQualityContextSchema,
});

export const AssistantChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: SafeShortTextSchema(1, 1200),
});

export const AssistantChatRequestSchema = z.object({
  question: SafeShortTextSchema(2, 600),
  history: z.array(AssistantChatTurnSchema).max(10).optional().default([]),
  profile: UserProfileSchema,
  airQuality: AirQualityContextSchema,
  planSummary: SafeShortTextSchema(5, 500).optional(),
});
