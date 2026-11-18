import type {
  AirQualityContext,
  RecommendationPriority,
  StructuredRecommendation,
  UserProfile,
} from '../shared/types.ts';
import {
  isElevatedPollutionLevel,
  isUnhealthyOrWorseLevel,
  isVeryUnhealthyOrWorseLevel,
} from './aqCategorizer.ts';

export const PRIORITY_RANK_WEIGHT: Record<RecommendationPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function getPriorityWeight(priority: RecommendationPriority): number {
  return PRIORITY_RANK_WEIGHT[priority];
}

function getTimeOfDayContext(hour?: number): 'morning_peak' | 'midday' | 'evening_peak' | 'overnight' {
  const safeHour =
    typeof hour === 'number' && Number.isFinite(hour)
      ? Math.max(0, Math.min(23, Math.floor(hour)))
      : new Date().getHours();

  if (safeHour >= 6 && safeHour < 10) return 'morning_peak';
  if (safeHour >= 10 && safeHour < 17) return 'midday';
  if (safeHour >= 17 && safeHour < 22) return 'evening_peak';
  return 'overnight';
}

export function buildDeterministicRecommendations(
  profile: UserProfile,
  airQuality: AirQualityContext,
  options?: { currentHour?: number }
): StructuredRecommendation[] {
  const aqi = airQuality.aqi;
  const level = airQuality.category.level;
  const isMissingAqi = aqi === null;
  const isSevere = isUnhealthyOrWorseLevel(level);
  const isVerySevere = isVeryUnhealthyOrWorseLevel(level);
  const isSensitiveOrWorse = isElevatedPollutionLevel(level);
  const hasSensitiveGroup = profile.sensitivityGroup !== 'general';
  const timeBand = getTimeOfDayContext(options?.currentHour);

  const recommendations: StructuredRecommendation[] = [];

  // 1. Outdoor Exposure & Activity Timing Recommendation
  const exposurePriority: RecommendationPriority = isVerySevere
    ? 'critical'
    : isSevere && hasSensitiveGroup
      ? 'critical'
      : isSevere || isMissingAqi || (isSensitiveOrWorse && (hasSensitiveGroup || profile.outdoorHabit === 'daily_exercise'))
        ? 'high'
        : isSensitiveOrWorse || level === 'moderate'
          ? 'medium'
          : 'low';

  const timeNote =
    timeBand === 'morning_peak' || timeBand === 'evening_peak'
      ? 'During morning and evening hours, cooler boundary-layer air commonly traps vehicle and heating emissions near ground level.'
      : timeBand === 'midday'
        ? 'Midday warming can improve vertical dispersion, though local traffic corridors can still hold elevated concentrations.'
        : 'Overnight temperature inversions can accumulate stagnant fine particles outdoors.';

  recommendations.push({
    id: 'rec-exposure-timing',
    category: 'exposure',
    priority: exposurePriority,
    title: isSevere
      ? 'Shift intense outdoor exertion indoors'
      : isMissingAqi
        ? 'Use precautionary outdoor pacing'
        : isSensitiveOrWorse
          ? 'Shorten vigorous outdoor activity'
          : 'Time outdoor movement on quieter streets',
    action: isVerySevere
      ? 'Pause non-essential outdoor exercise today and keep outdoor trips brief.'
      : isSevere
        ? 'Move workouts indoors and limit outdoor walks to lower-traffic windows.'
        : isMissingAqi
          ? 'Keep outdoor exertion moderate and check local advisories until live AQI readings resolve.'
          : isSensitiveOrWorse
            ? 'Keep outdoor exertion under 20–30 minutes and pick residential or park paths over arterial roads.'
            : 'Enjoy normal outdoor movement along green corridors set back from heavy vehicle lanes.',
    reason: isMissingAqi
      ? `Live AQI is currently unavailable for ${airQuality.cityResolved}. ${timeNote}`
      : `${airQuality.cityResolved} is at ${airQuality.category.label} (US AQI ${aqi}, primary pollutant ${airQuality.dominantPollutant}). ${timeNote}`,
    mechanism:
      'Lower breathing minute-ventilation outdoors and greater distance from tailpipes reduce the volume of fine particulate matter inhaled.',
    impact:
      'Reduces cumulative personal inhalation of PM2.5 and traffic-related NO2 without eliminating safe indoor movement.',
    limitations:
      'Regional AQI monitors reflect area averages; roadside concentrations can be noticeably higher next to idling traffic.',
    sourceType: 'deterministic_rule',
    targetSection: 'daily-plan',
  });

  // 2. Commute & Transport Recommendation
  const isActiveCommuteInSmog = profile.commuteMode === 'walk_cycle' && isSevere;
  const transportPriority: RecommendationPriority = isActiveCommuteInSmog
    ? 'high'
    : profile.commuteMode === 'car_solo' && profile.commuteDistanceKm > 0
      ? isSensitiveOrWorse
        ? 'high'
        : 'medium'
      : isSevere
        ? 'medium'
        : 'low';

  recommendations.push({
    id: 'rec-transport-shift',
    category: 'transport',
    priority: transportPriority,
    title:
      profile.commuteMode === 'car_solo'
        ? 'Shift solo car trips or batch errands'
        : isActiveCommuteInSmog
          ? 'Protect active commute in heavy smog'
          : 'Maintain low-emission commute routing',
    action:
      profile.commuteMode === 'car_solo'
        ? profile.commuteDistanceKm > 0
          ? `Replace 1–2 solo ${profile.commuteDistanceKm} km commutes/week with transit or carpool, and bundle errands into one loop.`
          : 'Combine neighborhood errands into a single warm-engine trip rather than separate short drives.'
        : isActiveCommuteInSmog
          ? 'Temporarily switch long roadside bike/walk commutes to covered transit or wear a well-fitting particulate respirator.'
          : profile.commuteMode === 'remote_work'
            ? 'Avoid unnecessary midday car errands; group unavoidable trips into one loop.'
            : 'Use side streets away from diesel corridors and wait clear of idling bus or car lanes.',
    reason:
      profile.commuteMode === 'car_solo'
        ? `Solo driving (${profile.commuteDistanceKm} km each way) adds cold-start tailpipe exhaust during stagnant winter conditions.`
        : isActiveCommuteInSmog
          ? `Active commuting during ${airQuality.category.label} air increases breathing rate directly beside traffic lanes.`
          : 'Your current commute already avoids solo private-car emissions; minimizing roadside wait time reduces personal exposure.',
    mechanism:
      profile.commuteMode === 'car_solo'
        ? 'Eliminating solo vehicle-kilometres and repeated cold engine starts cuts tailpipe NOx, fine particles, and brake/tire dust.'
        : 'Increasing distance from exhaust plumes and lowering exertion in heavy smog reduces particle deposition.',
    impact:
      profile.commuteMode === 'car_solo'
        ? 'Directly lowers household transport emissions while easing local street-level pollution.'
        : 'Preserves low transport emissions while lowering your personal roadside exposure.',
    limitations:
      'Feasibility depends on local transit coverage, caregiving schedules, weather safety, and physical accessibility.',
    sourceType: 'deterministic_rule',
    targetSection: 'alternatives',
  });

  // 3. Indoor Air & Cooking Combustion Recommendation
  const isSolidFuel = profile.cookingFuel === 'solid_fuel_wood';
  const isUnventedGas =
    profile.cookingFuel === 'gas_stove' && profile.ventilationType === 'windows_only';
  const indoorPriority: RecommendationPriority = isSolidFuel
    ? 'critical'
    : isUnventedGas || (profile.cookingFuel === 'gas_stove' && isSensitiveOrWorse)
      ? 'high'
      : isSensitiveOrWorse || isMissingAqi
        ? 'medium'
        : 'low';

  recommendations.push({
    id: 'rec-indoor-air',
    category: 'indoor',
    priority: indoorPriority,
    title: isSolidFuel
      ? 'Eliminate indoor solid-fuel smoke'
      : profile.cookingFuel === 'gas_stove'
        ? 'Ventilate gas burners before ignition'
        : isSensitiveOrWorse
          ? 'Seal outdoor smog infiltration indoors'
          : 'Time cross-ventilation & cover pans',
    action: isSolidFuel
      ? 'Avoid burning wood, coal, or biomass indoors; shift daily boiling/simmering to electric appliances where safe and available.'
      : profile.cookingFuel === 'gas_stove'
        ? profile.ventilationType === 'windows_only'
          ? 'Crack a kitchen window and use a back burner with a lid during gas cooking, then close once steam/fumes clear.'
          : 'Run your exhaust hood 5 minutes before lighting gas burners and 10 minutes after finishing.'
        : isSensitiveOrWorse
          ? 'Keep exterior windows latched during morning/evening haze peaks and cover pans during high-heat frying.'
          : 'Open opposite-side windows briefly away from rush hour and cover pans when cooking with oil.',
    reason: isSolidFuel
      ? 'Indoor solid-fuel burning releases very high levels of fine smoke particles (PM2.5) and carbon monoxide into closed winter rooms.'
      : profile.cookingFuel === 'gas_stove'
        ? 'Gas burners generate nitrogen dioxide (NO2) and ultrafine particles inside the kitchen that accumulate when rooms are sealed for winter.'
        : 'Controlling indoor aerosols and timing window ventilation keeps indoor particulate buildup lower during outdoor haze.',
    mechanism:
      'Source control and active extraction capture combustion gases and cooking aerosols at the stove before they disperse through living spaces.',
    impact: `Helps maintain cleaner indoor baseline air for all ${profile.householdSize} household member${profile.householdSize > 1 ? 's' : ''}.`,
    limitations:
      'Recirculating hoods without outdoor ducts filter odors and grease better than NO2 gas; outdoor ventilation timing depends on real-time neighborhood smoke.',
    sourceType: 'deterministic_rule',
    targetSection: 'indoor-air',
  });

  // 4. Household Protection & Filtration Recommendation
  if (hasSensitiveGroup || profile.hasHepaFilter || isSevere) {
    const protectionPriority: RecommendationPriority =
      hasSensitiveGroup && isSevere
        ? 'critical'
        : hasSensitiveGroup && (isSensitiveOrWorse || isMissingAqi)
          ? 'high'
          : profile.hasHepaFilter && isSensitiveOrWorse
            ? 'high'
            : isSevere
              ? 'high'
              : 'medium';

    recommendations.push({
      id: 'rec-household-protection',
      category: 'protection',
      priority: protectionPriority,
      title: profile.hasHepaFilter
        ? 'Run continuous bedroom HEPA filtration'
        : hasSensitiveGroup
          ? 'Protect sensitive household members'
          : 'Create a sealed clean-air sleeping room',
      action: profile.hasHepaFilter
        ? 'Keep bedroom doors closed and run your true-HEPA purifier continuously on Medium/Quiet rather than toggling it off.'
        : 'Keep one sleeping room tightly sealed with door draft stoppers and avoid candles, incense, or dry sweeping inside.',
      reason: hasSensitiveGroup
        ? `Household profile includes ${profile.sensitivityGroup === 'children_elderly' ? 'children or older adults' : 'respiratory sensitivities'}, who experience greater discomfort from elevated particulates.`
        : 'Keeping particulate concentration lower across 7–8 overnight hours substantially reduces total daily inhaled load.',
      mechanism:
        profile.hasHepaFilter
          ? 'Mechanical HEPA media physically traps airborne PM2.5 particles inside a smaller closed room volume.'
          : 'Reducing air leaks and eliminating indoor combustion sources limits particle accumulation without relying on unverified devices.',
      impact:
        profile.hasHepaFilter
          ? 'Supports lower overnight particulate exposure in the main occupied room.'
          : 'Creates a lower-particle resting space without claiming unverified mechanical filtration benefits.',
      limitations:
        profile.hasHepaFilter
          ? 'Requires a purifier sized (CADR) for the room area and closed doors/windows to stay effective.'
          : 'Draft sealing alone slows infiltration but does not actively remove particles already indoors; guidance is non-medical.',
      sourceType: 'deterministic_rule',
      targetSection: 'indoor-air',
    });
  }

  // Deterministic sort: priority weight descending, then stable domain tie-breaker
  const domainOrder: Record<StructuredRecommendation['category'], number> = {
    protection: 5,
    exposure: 4,
    indoor: 3,
    transport: 2,
    energy: 1,
  };

  return [...recommendations].sort((a, b) => {
    const diff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (diff !== 0) return diff;
    return domainOrder[b.category] - domainOrder[a.category];
  });
}
