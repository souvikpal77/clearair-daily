import { EMISSION_ASSUMPTIONS } from '../shared/constants.ts';
import type {
  AirQualityContext,
  CommuteMode,
  CommunityProjection,
  ImpactChain,
  OutdoorHabit,
  SensitivityGroup,
  UserProfile,
} from '../shared/types.ts';
import { buildDeterministicAlternatives } from './alternativesEngine.ts';
import { isElevatedPollutionLevel, US_EPA_AQI_THRESHOLDS } from './aqCategorizer.ts';

export { buildDeterministicAlternatives };

export const IMPACT_MODEL_BOUNDS = {
  maxOneWayDistanceKm: 150,
  maxTripsReplacedPerWeek: 14,
  maxWeeklyTripsTracked: 50,
  maxCommunityHouseholds: 10000,
  defaultFallbackDistanceKm: 6,
} as const;

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function sanitizePositiveFinite(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(max, value);
}

export function estimateWeeklyTripReductionRange(
  distanceKmOneWay: number,
  tripsReplacedPerWeek: number
): {
  kmReduced: number;
  soloCarCo2Range: [number, number];
  transitNetSavingsRange: [number, number];
} {
  const safeDistance = sanitizePositiveFinite(
    distanceKmOneWay,
    IMPACT_MODEL_BOUNDS.maxOneWayDistanceKm
  );
  const safeTrips = sanitizePositiveFinite(
    tripsReplacedPerWeek,
    IMPACT_MODEL_BOUNDS.maxTripsReplacedPerWeek
  );
  const roundTripKm = safeDistance * 2 * safeTrips;

  const soloLow = roundTripKm * EMISSION_ASSUMPTIONS.carSoloKgCo2PerKmLow;
  const soloHigh = roundTripKm * EMISSION_ASSUMPTIONS.carSoloKgCo2PerKmHigh;

  const transitLow = roundTripKm * EMISSION_ASSUMPTIONS.publicTransitKgCo2PerKmLow;
  const transitHigh = roundTripKm * EMISSION_ASSUMPTIONS.publicTransitKgCo2PerKmHigh;

  return {
    kmReduced: roundToOne(roundTripKm),
    soloCarCo2Range: [roundToOne(soloLow), roundToOne(soloHigh)],
    transitNetSavingsRange: [
      roundToOne(Math.max(0, soloLow - transitHigh)),
      roundToOne(Math.max(0, soloHigh - transitLow)),
    ],
  };
}

export function calculateTransportImpact(params: {
  commuteMode: CommuteMode;
  commuteDistanceKm: number;
  tripsReplacedPerWeek: number;
}): {
  kmReduced: number;
  soloCarCo2Range: [number, number];
  netCo2SavedRange: [number, number];
  assumptions: string;
  limitations: string;
} {
  if (params.commuteMode === 'remote_work') {
    return {
      kmReduced: 0,
      soloCarCo2Range: [0, 0],
      netCo2SavedRange: [0, 0],
      assumptions: 'Profile commute mode is remote_work; no daily vehicle commute to replace.',
      limitations: 'Home heating and electricity demand still contribute indirect energy emissions.',
    };
  }

  const estimate = estimateWeeklyTripReductionRange(
    params.commuteDistanceKm,
    params.tripsReplacedPerWeek
  );

  if (params.commuteMode !== 'car_solo') {
    return {
      kmReduced: 0,
      soloCarCo2Range: [0, 0],
      netCo2SavedRange: [0, 0],
      assumptions: `Profile already uses ${params.commuteMode.replace('_', ' ')} rather than solo driving.`,
      limitations:
        'Switching from shared transit or active transport yields minimal extra tailpipe savings compared to shifting solo car trips.',
    };
  }

  return {
    kmReduced: estimate.kmReduced,
    soloCarCo2Range: estimate.soloCarCo2Range,
    netCo2SavedRange: estimate.transitNetSavingsRange,
    assumptions:
      'Assumes 0.16–0.22 kg CO2e/km for solo passenger car travel vs 0.04–0.08 kg CO2e/passenger-km for urban public transit.',
    limitations:
      'Actual emissions difference depends on vehicle fuel/efficiency, local transit grid mix, and trip occupancy.',
  };
}

export function calculateTripReduction(params: {
  averageTripDistanceKm: number;
  separateTripsPerWeek: number;
  consolidatedTripsPerWeek: number;
}): {
  tripsEliminatedPerWeek: number;
  coldStartsAvoided: number;
  assumptions: string;
  limitations: string;
} {
  const separate = Math.round(
    sanitizePositiveFinite(params.separateTripsPerWeek, IMPACT_MODEL_BOUNDS.maxWeeklyTripsTracked)
  );
  const consolidated = Math.round(
    sanitizePositiveFinite(params.consolidatedTripsPerWeek, IMPACT_MODEL_BOUNDS.maxWeeklyTripsTracked)
  );
  const eliminated = Math.max(0, separate - consolidated);
  const safeDist = sanitizePositiveFinite(
    params.averageTripDistanceKm,
    IMPACT_MODEL_BOUNDS.maxOneWayDistanceKm
  );

  return {
    tripsEliminatedPerWeek: eliminated,
    coldStartsAvoided: eliminated,
    assumptions: `Evaluates consolidating ${separate} separate ${safeDist} km errand trips into ${consolidated} combined loop(s).`,
    limitations:
      'Exact cold-start NOx/hydrocarbon reductions depend on ambient temperature, engine age, and detour distance between stops.',
  };
}

export function calculateActivityImpact(params: {
  outdoorHabit: OutdoorHabit;
  aqi: number | null;
  sensitivityGroup: SensitivityGroup;
}): {
  exposureRiskTier: 'low' | 'moderate' | 'elevated' | 'precautionary';
  recommendedAction: string;
  mechanism: string;
  limitations: string;
} {
  if (
    params.aqi === null ||
    !Number.isFinite(params.aqi) ||
    params.aqi < 0 ||
    params.aqi > US_EPA_AQI_THRESHOLDS.maxValidAqi
  ) {
    return {
      exposureRiskTier: 'precautionary',
      recommendedAction: 'Prefer moderate-intensity activity until live local readings are confirmed.',
      mechanism:
        'Avoiding sustained heavy outdoor breathing prevents unverified particulate inhalation when sensor data is missing.',
      limitations: 'Precautionary estimate only; verify official local advisories.',
    };
  }

  if (
    params.aqi > US_EPA_AQI_THRESHOLDS.sensitiveMax ||
    (params.aqi > US_EPA_AQI_THRESHOLDS.moderateMax && params.sensitivityGroup !== 'general')
  ) {
    return {
      exposureRiskTier: 'elevated',
      recommendedAction:
        params.outdoorHabit === 'daily_exercise'
          ? 'Shift vigorous exercise indoors and shorten outdoor walks.'
          : 'Keep outdoor trips brief and avoid busy road corridors.',
      mechanism:
        'Higher respiratory minute-ventilation during outdoor exercise draws fine PM2.5 deeper into airways.',
      limitations:
        'Individual respiratory response varies; guidance is informational and not a medical assessment.',
    };
  }

  if (params.aqi > US_EPA_AQI_THRESHOLDS.goodMax) {
    return {
      exposureRiskTier: 'moderate',
      recommendedAction: 'Keep outdoor activity on low-traffic parks or residential side streets.',
      mechanism:
        'Increasing physical setback from vehicle lanes lowers exposure to fresh exhaust plumes and road dust.',
      limitations: 'Ambient monitor readings do not reflect localized idling traffic hotspots.',
    };
  }

  return {
    exposureRiskTier: 'low',
    recommendedAction: 'Normal outdoor activity suitable for most households.',
    mechanism: 'Low ambient particulate concentration keeps outdoor inhaled particle load low.',
    limitations: 'Sudden wind shifts or local smoke plumes can still elevate street-level readings.',
  };
}

export function buildDeterministicImpactChains(
  profile: UserProfile,
  airQuality: AirQualityContext
): ImpactChain[] {
  const chains: ImpactChain[] = [];
  const isElevatedSmog = isElevatedPollutionLevel(airQuality.category.level);

  if (profile.commuteMode === 'car_solo' && profile.commuteDistanceKm > 0) {
    const transport = calculateTransportImpact({
      commuteMode: profile.commuteMode,
      commuteDistanceKm: profile.commuteDistanceKm,
      tripsReplacedPerWeek: 2,
    });
    chains.push({
      id: 'impact-commute-shift',
      title: 'Shift 2 solo car commutes/week to transit or shared rides',
      action: `Replace 2 solo round-trip drives (${profile.commuteDistanceKm} km each way) with public transit or carpooling`,
      mechanism:
        'Eliminates 4 cold-start engine cycles and removes solo vehicle-kilometres during peak winter boundary-layer trapping',
      directImpact:
        'Fewer tailpipe NOx, fine particle exhaust, and brake/tire wear emissions along neighborhood corridors',
      estimatedRangeLabel: `Est. ${transport.kmReduced} km fewer solo car km/week (~${transport.netCo2SavedRange[0]}–${transport.netCo2SavedRange[1]} kg CO2e saved vs solo driving)`,
      assumptions: transport.assumptions,
      limitations: transport.limitations,
      category: 'mobility',
    });
  } else {
    const consolidation = calculateTripReduction({
      averageTripDistanceKm: Math.max(3, profile.commuteDistanceKm || 5),
      separateTripsPerWeek: 4,
      consolidatedTripsPerWeek: 2,
    });
    chains.push({
      id: 'impact-errand-batching',
      title: 'Combine household errands into a single warm-engine loop',
      action: 'Bundle grocery, school, and pharmacy errands into one planned trip rather than separate short drives',
      mechanism:
        'Avoids repeated cold-start catalytic converter warm-up periods where tailpipe pollutants spike in cold winter air',
      directImpact:
        'Lower local street-level PM and NO2 accumulation around residential blocks and school zones',
      estimatedRangeLabel: `Est. ${consolidation.coldStartsAvoided} fewer cold-start errand loops/week`,
      assumptions: consolidation.assumptions,
      limitations: consolidation.limitations,
      category: 'mobility',
    });
  }

  if (profile.cookingFuel === 'gas_stove' || profile.cookingFuel === 'solid_fuel_wood') {
    chains.push({
      id: 'impact-cooking-vent',
      title: 'Run mechanical exhaust before and during indoor cooking',
      action:
        profile.cookingFuel === 'solid_fuel_wood'
          ? 'Transition high-smoke cooking steps outdoors or to electric appliances and vent continuously'
          : 'Turn on ducted range hood 5 minutes before lighting gas burners and keep running 10 minutes after',
      mechanism:
        'Captures combustion NO2, ultrafine particles, and cooking aerosols at the burner plume before they mix into living rooms',
      directImpact:
        'Substantially reduces peak indoor NO2 and PM2.5 exposure for all ' +
        `${profile.householdSize} household member${profile.householdSize > 1 ? 's' : ''}`,
      estimatedRangeLabel: 'Qualitative reduction in peak kitchen NO2 & cooking PM2.5 when vented outdoors',
      assumptions:
        'Applies to externally vented range hoods or switching away from unvented combustion.',
      limitations:
        'Recirculating carbon filters capture grease and odors better than nitrogen dioxide gas.',
      category: 'indoor',
    });
  } else {
    chains.push({
      id: 'impact-indoor-filtration',
      title: 'Seal winter infiltration and filter recirculated indoor air',
      action: isElevatedSmog
        ? 'Keep exterior windows closed during morning/evening inversion peaks and run HEPA filtration continuously on medium'
        : 'Time brief 15-minute cross-ventilation for midday dispersion while keeping indoor combustion sources off',
      mechanism:
        'Reduces outdoor PM2.5 infiltration rate during stagnant hours while physically trapping suspended fine particles indoors',
      directImpact:
        'Lowers cumulative daily particulate inhalation without increasing indoor carbon monoxide or NO2',
      estimatedRangeLabel: 'Qualitative cleaner indoor baseline during peak outdoor smog hours',
      assumptions:
        'Assumes room doors/windows are kept closed during elevated outdoor AQI.',
      limitations:
        'Actual indoor particle reduction depends on building air-leakage and purifier Clean Air Delivery Rate (CADR).',
      category: 'indoor',
    });
  }

  const activityImpact = calculateActivityImpact({
    outdoorHabit: profile.outdoorHabit,
    aqi: airQuality.aqi,
    sensitivityGroup: profile.sensitivityGroup,
  });

  chains.push({
    id: 'impact-exposure-timing',
    title: 'Shift outdoor activity away from winter inversion hours',
    action: isElevatedSmog
      ? 'Move vigorous exercise indoors and schedule essential outdoor walks between 13:00 and 16:00 if visibility improves'
      : 'Schedule outdoor exercise on lower-traffic park corridors away from arterial roads',
    mechanism: activityImpact.mechanism,
    directImpact:
      'Reduces inhaled fine particle dose while preserving daily physical movement safely',
    estimatedRangeLabel: 'Lower personal particulate dose vs rush-hour roadside exertion',
    assumptions:
      'Winter temperature inversions frequently trap overnight and morning emissions near ground level; solar warming can improve midday dispersion.',
    limitations: activityImpact.limitations,
    category: 'exposure',
  });

  return chains;
}

export function calculateCommunityProjection(
  profile: UserProfile,
  participatingHouseholds: number,
  weeklyTripsAvoidedPerHousehold = 2
): CommunityProjection {
  const safeHouseholds = Math.max(
    1,
    Math.min(IMPACT_MODEL_BOUNDS.maxCommunityHouseholds, Math.round(participatingHouseholds))
  );
  const effectiveDistanceKm =
    profile.commuteDistanceKm > 0
      ? profile.commuteDistanceKm
      : IMPACT_MODEL_BOUNDS.defaultFallbackDistanceKm;
  const single = estimateWeeklyTripReductionRange(
    effectiveDistanceKm,
    weeklyTripsAvoidedPerHousehold
  );

  return {
    participatingHouseholds: safeHouseholds,
    individualWeeklyTripsAvoided: weeklyTripsAvoidedPerHousehold,
    individualEstimatedCo2KgRange: single.transitNetSavingsRange,
    collectiveEstimatedCo2KgRange: [
      roundToOne(single.transitNetSavingsRange[0] * safeHouseholds),
      roundToOne(single.transitNetSavingsRange[1] * safeHouseholds),
    ],
    individualEstimatedKmReduced: single.kmReduced,
    collectiveEstimatedKmReduced: roundToOne(single.kmReduced * safeHouseholds),
    methodologyNote:
      `Illustrative scenario math assuming ${safeHouseholds} households each replace ${weeklyTripsAvoidedPerHousehold} ` +
      `round-trips/week of ${effectiveDistanceKm} km solo driving with shared transit (est. 0.16–0.22 vs 0.04–0.08 kg CO2e/km). ` +
      'Represents proportional activity-emission reductions, not a city-wide ambient AQI forecast.',
  };
}
