export type CommuteMode =
  | 'car_solo'
  | 'carpool'
  | 'public_transit'
  | 'walk_cycle'
  | 'remote_work';

export type WorkSchedule = 'standard_9_to_5' | 'early_shift' | 'flexible_hybrid' | 'home_based';

export type OutdoorHabit = 'daily_exercise' | 'short_walks' | 'mostly_indoors';

export type CookingFuel = 'gas_stove' | 'induction_electric' | 'solid_fuel_wood';

export type VentilationType = 'windows_only' | 'exhaust_hood' | 'mechanical_hvac';

export type SensitivityGroup = 'general' | 'children_elderly' | 'respiratory_sensitive';

export type AqSeverityLevel =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export type DataSourceKind = 'live' | 'scenario_estimate';

export type DataConfidence = 'high' | 'estimated';

export type PlanningScenarioId =
  | 'live'
  | 'moderate_winter_haze'
  | 'severe_winter_inversion'
  | 'clean_breeze_day';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecommendationDomain =
  | 'exposure'
  | 'transport'
  | 'indoor'
  | 'energy'
  | 'protection';

export type FreshnessStatus = 'live_fresh' | 'live_stale' | 'estimated' | 'unavailable';

export interface DataFreshness {
  status: FreshnessStatus;
  label: string;
  detail: string;
  isLive: boolean;
}

export interface ExternalCategoryMetadata {
  providerLabel: string;
  source: string;
}

export interface UserProfile {
  city: string;
  householdSize: number;
  commuteMode: CommuteMode;
  commuteDistanceKm: number;
  workSchedule: WorkSchedule;
  outdoorHabit: OutdoorHabit;
  cookingFuel: CookingFuel;
  ventilationType: VentilationType;
  hasHepaFilter: boolean;
  sensitivityGroup: SensitivityGroup;
}

export interface PollutantReading {
  code: 'PM2.5' | 'PM10' | 'NO2' | 'O3' | 'SO2' | 'CO';
  name: string;
  value: number | null;
  unit: string;
  note: string;
}

export interface AqCategoryInfo {
  level: AqSeverityLevel;
  label: string;
  shortGuidance: string;
  badgeTone: 'green' | 'amber' | 'orange' | 'red' | 'purple';
  outdoorMultiplier: string;
}

export interface AirQualityContext {
  cityResolved: string;
  countryOrRegion: string;
  latitude: number | null;
  longitude: number | null;
  aqi: number | null;
  category: AqCategoryInfo;
  externalCategory?: ExternalCategoryMetadata;
  dominantPollutant: string;
  pollutants: PollutantReading[];
  observedAt: string | null;
  dataSource: DataSourceKind;
  provider: string;
  confidence: DataConfidence;
  statusNote: string;
  scenarioId: PlanningScenarioId;
}

export interface StructuredRecommendation {
  id: string;
  category: RecommendationDomain;
  priority: RecommendationPriority;
  title: string;
  action: string;
  reason: string;
  mechanism: string;
  impact: string;
  limitations: string;
  sourceType: 'deterministic_rule' | 'ai_personalized';
  targetSection: 'daily-plan' | 'indoor-air' | 'alternatives';
}

export interface PlanTimeSlot {
  id: string;
  windowLabel: string;
  title: string;
  guidance: string;
  priority: 'high' | 'moderate' | 'low';
  avoidOrReduce?: string;
  context?: 'indoor' | 'outdoor' | 'commute' | 'mixed';
  reason?: string;
}

export interface ImpactChain {
  id: string;
  title: string;
  action: string;
  mechanism: string;
  directImpact: string;
  estimatedRangeLabel: string;
  assumptions: string;
  limitations?: string;
  category: 'mobility' | 'indoor' | 'exposure' | 'energy';
}

export interface IndoorGuidanceItem {
  id: string;
  area: 'Ventilation' | 'Cooking' | 'Filtration' | 'Combustion' | 'Living Space';
  title: string;
  guidance: string;
  sourceType: 'evidence_based' | 'ai_personalized';
  rationale: string;
  limitations?: string;
}

export interface AlternativeComparison {
  id: string;
  domain: string;
  currentChoice: string;
  alternativeChoice: string;
  practicality: 'High' | 'Moderate' | 'Situational';
  environmentalReasoning: string;
  estimatedImpact: string;
  assumptions: string;
  tradeOffs: string;
  whenNotSuitable: string;
}

export interface ActionChecklistItem {
  id: string;
  label: string;
  category: 'exposure' | 'emissions' | 'indoor';
  timeWindow: string;
}

export interface CommunityProjection {
  participatingHouseholds: number;
  individualWeeklyTripsAvoided: number;
  individualEstimatedCo2KgRange: [number, number];
  collectiveEstimatedCo2KgRange: [number, number];
  individualEstimatedKmReduced: number;
  collectiveEstimatedKmReduced: number;
  methodologyNote: string;
}

export interface AiPlanPayload {
  summary: string;
  priorities: string[];
  dailyPlan: PlanTimeSlot[];
  indoorActions: IndoorGuidanceItem[];
  lowEmissionAlternatives: AlternativeComparison[];
  impactExplanations: ImpactChain[];
  cautions: string[];
}

export interface GeneratedAirPlanResponse {
  plan: AiPlanPayload;
  recommendations?: StructuredRecommendation[];
  checklist: ActionChecklistItem[];
  generationMode: 'gemini_personalized' | 'deterministic_fallback';
  fallbackNotice: string | null;
  generatedAt: string;
  disclaimer: string;
}

export interface StructuredAssistantReply {
  answer: string;
  recommendations: string[];
  impactExplanation: string;
  cautions: string[];
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structuredReply?: StructuredAssistantReply;
  createdAt: string;
  mode?: 'gemini_grounded' | 'deterministic_fallback';
}

export interface AssistantChatResponse {
  reply: string;
  structuredReply?: StructuredAssistantReply;
  mode: 'gemini_grounded' | 'deterministic_fallback';
  groundedContextSummary: string;
  disclaimer: string;
}

export interface AssistantContext {
  profile: UserProfile;
  airQuality: AirQualityContext;
  recommendations: readonly StructuredRecommendation[];
  dailyPlan: readonly PlanTimeSlot[];
  alternatives: readonly AlternativeComparison[];
  planSummary?: string;
}

// Semantic domain aliases aligned with core domain architecture
export type AirQualityData = AirQualityContext;
export type PollutantData = PollutantReading;
export type AirQualityCategory = AqCategoryInfo;
export type HouseholdProfile = UserProfile;
export type DailyActivity = PlanTimeSlot;
export type Recommendation = StructuredRecommendation;
export type ImpactExplanation = ImpactChain;
export type Alternative = AlternativeComparison;
export type DailyPlan = AiPlanPayload;
export type DataSource = DataSourceKind;
