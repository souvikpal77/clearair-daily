import type { PlanningScenarioId, UserProfile } from './types.ts';

export const DEFAULT_USER_PROFILE: UserProfile = {
  city: 'Delhi',
  householdSize: 3,
  commuteMode: 'car_solo',
  commuteDistanceKm: 12,
  workSchedule: 'standard_9_to_5',
  outdoorHabit: 'short_walks',
  cookingFuel: 'gas_stove',
  ventilationType: 'exhaust_hood',
  hasHepaFilter: false,
  sensitivityGroup: 'children_elderly',
};

export const PLANNING_SCENARIOS: ReadonlyArray<{
  id: PlanningScenarioId;
  label: string;
  summary: string;
}> = [
  {
    id: 'live',
    label: 'Live City Lookup',
    summary: 'Uses Open-Meteo real-time air quality telemetry when available.',
  },
  {
    id: 'moderate_winter_haze',
    label: 'Scenario: Moderate Winter Haze',
    summary: 'Estimated afternoon haze scenario (US AQI ~128, elevated PM2.5).',
  },
  {
    id: 'severe_winter_inversion',
    label: 'Scenario: Severe Winter Inversion',
    summary: 'Estimated cold-air inversion smog episode (US AQI ~225, high PM2.5 & NO2).',
  },
  {
    id: 'clean_breeze_day',
    label: 'Scenario: Clean Breeze Day',
    summary: 'Estimated post-wind dispersion day (US AQI ~38, good ventilation window).',
  },
];

export const RESPONSIBLE_AI_DISCLAIMER =
  'Informational guidance only — not medical advice, diagnosis, or treatment. Live air quality can change rapidly across neighborhoods; follow official local public-health advisories during severe pollution episodes.';

export const QUICK_ASSISTANT_PROMPTS: readonly string[] = [
  'How should I plan my commute today?',
  'What can I do to improve air quality indoors?',
  'How can my family reduce pollution-related exposure?',
  'What are lower-emission alternatives to my routine?',
];

export const MAX_VALID_AQI = 1000;

export const EMISSION_ASSUMPTIONS = {
  carSoloKgCo2PerKmLow: 0.16,
  carSoloKgCo2PerKmHigh: 0.22,
  publicTransitKgCo2PerKmLow: 0.04,
  publicTransitKgCo2PerKmHigh: 0.08,
} as const;
