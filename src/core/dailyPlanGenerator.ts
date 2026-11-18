import type {
  ActionChecklistItem,
  AiPlanPayload,
  AirQualityContext,
  PlanTimeSlot,
  UserProfile,
} from '../shared/types.ts';
import {
  isElevatedPollutionLevel,
  isUnhealthyOrWorseLevel,
  US_EPA_AQI_THRESHOLDS,
} from './aqCategorizer.ts';
import {
  buildDeterministicAlternatives,
  buildDeterministicImpactChains,
} from './impactCalculator.ts';
import { buildDeterministicIndoorGuidance } from './indoorGuidance.ts';
import { buildDeterministicRecommendations } from './recommendationEngine.ts';

// Upper-Moderate precautionary AQI cutoff for households with sensitive groups
const SENSITIVE_GROUP_OUTDOOR_PRECAUTION_AQI = 85;

export function buildDeterministicPlan(
  profile: UserProfile,
  airQuality: AirQualityContext,
  options?: { currentHour?: number }
): AiPlanPayload {
  const aqi = airQuality.aqi;
  const level = airQuality.category.level;
  const isMissingAqi = aqi === null;
  const isSevere = isUnhealthyOrWorseLevel(level);
  const isSensitiveOrWorse = isElevatedPollutionLevel(level) || isMissingAqi;
  const hasVulnerableGroup = profile.sensitivityGroup !== 'general';

  const recommendations = buildDeterministicRecommendations(profile, airQuality, options);

  const commuteWindow =
    profile.workSchedule === 'early_shift'
      ? '06:00 – 08:00'
      : profile.workSchedule === 'flexible_hybrid'
        ? '09:30 – 11:00'
        : '08:00 – 10:00';

  const commuteAdvice = (() => {
    if (profile.commuteMode === 'remote_work' || profile.workSchedule === 'home_based') {
      return 'Work or study from home today to avoid rush-hour traffic pollution and eliminate a vehicle commute.';
    }
    if (profile.commuteMode === 'car_solo') {
      return isSensitiveOrWorse
        ? 'If transit is practical, switch today’s commute to metro/bus or carpool; if driving, set cabin climate to recirculate in heavy traffic.'
        : 'Consider carpooling or public transit twice this week, and combine errands into one warm-engine loop.';
    }
    if (profile.commuteMode === 'walk_cycle') {
      return isSevere
        ? 'Pause long bike/walk commutes along arterial roads today; use covered public transit or wear a well-fitting particulate mask.'
        : 'Take residential side-streets set back from heavy vehicle lanes to lower curbside NO2 and particle inhalation.';
    }
    return 'Wait indoors until transit arrives when possible, and choose seating away from open doors in tunnel/road corridors.';
  })();

  const outdoorGuidance = (() => {
    if (isSevere) {
      return 'Replace outdoor cardio with indoor stretching, bodyweight, or stationary movement today.';
    }
    if (isMissingAqi) {
      return 'Prefer brief, moderate-intensity outdoor movement until live local readings are confirmed.';
    }
    if (
      isSensitiveOrWorse ||
      (hasVulnerableGroup && aqi !== null && aqi > SENSITIVE_GROUP_OUTDOOR_PRECAUTION_AQI)
    ) {
      return 'Keep outdoor time brief (under 20–30 minutes), avoid vigorous exertion near busy roads, and prefer midday hours if haze thins.';
    }
    return 'Conditions support normal outdoor walks; stick to green corridors or parks separated from high-speed traffic.';
  })();

  const dailyPlan: PlanTimeSlot[] = [
    {
      id: 'slot-morning',
      windowLabel: '06:30 – 09:00',
      title: 'Morning Air & Departure Prep',
      guidance: isSensitiveOrWorse
        ? 'Keep bedroom windows closed against early morning inversion buildup; check live local conditions before school or work departure.'
        : 'Check morning AQI before opening windows; run kitchen exhaust while preparing breakfast.',
      priority: 'high',
      context: 'indoor',
      reason: 'Early morning cold-air inversions commonly trap overnight heating and traffic emissions near ground level.',
      avoidOrReduce: 'Avoid early-morning outdoor jogging along main roads.',
    },
    {
      id: 'slot-commute',
      windowLabel: commuteWindow,
      title: 'Commute & School Run',
      guidance: commuteAdvice,
      priority: 'high',
      context: profile.commuteMode === 'remote_work' ? 'indoor' : 'commute',
      reason:
        profile.workSchedule === 'flexible_hybrid'
          ? 'Shifting travel slightly past peak rush hour cuts time spent behind idling cold-start traffic.'
          : 'Peak morning travel combines highest traffic density with stagnant winter air.',
      avoidOrReduce: 'Avoid vehicle idling at drop-off zones or drive-through lanes.',
    },
    {
      id: 'slot-midday',
      windowLabel: '12:30 – 15:30',
      title: 'Midday Dispersion & Errands',
      guidance: isSevere
        ? 'Keep indoor doors/windows sealed; batch essential errands into a single trip rather than multiple short outings.'
        : 'Midday solar warming often improves dispersion—use this window for brief cross-ventilation or essential errands if readings dip.',
      priority: 'moderate',
      context: 'mixed',
      reason: 'Daytime warming deepens the atmospheric mixing layer compared to dawn and dusk.',
      avoidOrReduce: 'Avoid splitting errands into multiple separate cold-start car trips.',
    },
    {
      id: 'slot-outdoor',
      windowLabel: '15:30 – 18:00',
      title: 'Afternoon Activity Window',
      guidance: outdoorGuidance,
      priority: isSensitiveOrWorse ? 'high' : 'low',
      context: isSevere ? 'indoor' : 'outdoor',
      reason:
        profile.outdoorHabit === 'daily_exercise'
          ? 'Higher breathing rates amplify inhaled particulate load when outdoor AQI is elevated.'
          : 'Controlled timing preserves healthy daily movement while limiting particle exposure.',
      avoidOrReduce: isSensitiveOrWorse
        ? 'Avoid prolonged outdoor sports or high-breathing-rate exercise.'
        : undefined,
    },
    {
      id: 'slot-evening',
      windowLabel: '18:00 – 21:00',
      title: 'Evening Cooking & Cooling',
      guidance:
        profile.cookingFuel === 'gas_stove'
          ? 'Latch exterior windows before evening inversion sets in, and run your range hood continuously while cooking dinner.'
          : 'Close exterior windows before evening rush-hour smog settles, and cover pans during stovetop cooking.',
      priority: 'high',
      context: 'indoor',
      reason: 'Evening cooking emissions plus cooling outdoor air create peak indoor-outdoor pollutant overlap.',
      avoidOrReduce: 'Avoid burning candles, incense, or indoor wood fires.',
    },
    {
      id: 'slot-sleep',
      windowLabel: '21:00 – 06:30',
      title: 'Overnight Clean Sleep Zone',
      guidance: profile.hasHepaFilter
        ? 'Keep bedroom door closed and run your HEPA purifier on a quiet continuous setting overnight.'
        : 'Keep bedroom windows latched and seal noticeable door/window drafts to preserve cleaner sleeping air.',
      priority: 'moderate',
      context: 'indoor',
      reason: 'Sleeping occupies ~7–8 continuous hours indoors, making bedroom air cleanliness high-leverage.',
    },
  ];

  const priorities = recommendations.slice(0, 4).map((rec) => rec.action);

  const cautions: string[] = [
    airQuality.dataSource === 'scenario_estimate'
      ? 'This plan is anchored to an estimated planning scenario rather than live neighborhood sensor telemetry.'
      : 'Monitor local updates as winter wind shifts can raise or lower particulate levels within hours.',
    'This assistant provides practical environmental guidance only and is not a substitute for medical care or official emergency orders.',
  ];

  if (profile.sensitivityGroup !== 'general') {
    cautions.unshift(
      'Because your household includes sensitive members, keep prescribed respiratory medications accessible and consult a clinician if symptoms arise.'
    );
  }

  return {
    summary:
      `Tailored ${airQuality.category.label.toLowerCase()} plan for ${airQuality.cityResolved} ` +
      `(household of ${profile.householdSize}). Focuses on lowering ${airQuality.dominantPollutant} exposure ` +
      `while cutting avoidable ${profile.commuteMode === 'car_solo' ? 'vehicle' : 'indoor combustion'} emissions.`,
    priorities,
    dailyPlan,
    indoorActions: buildDeterministicIndoorGuidance(profile, airQuality),
    lowEmissionAlternatives: buildDeterministicAlternatives(profile, airQuality),
    impactExplanations: buildDeterministicImpactChains(profile, airQuality),
    cautions,
  };
}

export function buildActionChecklist(
  profile: UserProfile,
  airQuality: AirQualityContext
): ActionChecklistItem[] {
  const isElevated =
    airQuality.aqi === null || airQuality.aqi > US_EPA_AQI_THRESHOLDS.moderateMax;
  return [
    {
      id: 'chk-morning-check',
      label: 'Check morning conditions before opening windows',
      category: 'exposure',
      timeWindow: 'Morning',
    },
    {
      id: 'chk-commute',
      label:
        profile.commuteMode === 'car_solo'
          ? 'Use transit, carpool, or batch errands into one warm-engine loop'
          : 'Choose low-traffic route and avoid idling vehicle zones',
      category: 'emissions',
      timeWindow: 'Commute',
    },
    {
      id: 'chk-cooking',
      label:
        profile.cookingFuel === 'gas_stove'
          ? 'Run kitchen exhaust hood 5 min before and 10 min after gas cooking'
          : 'Cover cookware and vent cooking steam/aerosols',
      category: 'indoor',
      timeWindow: 'Meals',
    },
    {
      id: 'chk-no-burn',
      label: 'Keep home free of candles, incense, and unvented smoke',
      category: 'indoor',
      timeWindow: 'All Day',
    },
    {
      id: 'chk-outdoor',
      label: isElevated
        ? 'Shift vigorous exercise indoors and shorten outdoor exertion'
        : 'Take outdoor walk on low-traffic park or residential streets',
      category: 'exposure',
      timeWindow: 'Afternoon',
    },
    {
      id: 'chk-sleep-zone',
      label: profile.hasHepaFilter
        ? 'Run HEPA filter continuously in closed sleeping room overnight'
        : 'Seal bedroom drafts and keep windows latched during overnight inversion',
      category: 'indoor',
      timeWindow: 'Night',
    },
  ];
}
