import { EMISSION_ASSUMPTIONS } from '../shared/constants.ts';
import type {
  AirQualityContext,
  AlternativeComparison,
  UserProfile,
} from '../shared/types.ts';
import { isUnhealthyOrWorseLevel } from './aqCategorizer.ts';
import { estimateWeeklyTripReductionRange } from './impactCalculator.ts';

const MAX_PRACTICAL_ACTIVE_COMMUTE_KM = 5;

export function isActiveCommutePractical(
  profile: UserProfile,
  airQuality: AirQualityContext
): { practical: boolean; reasonIfNot: string } {
  const level = airQuality.category.level;

  if (isUnhealthyOrWorseLevel(level)) {
    return {
      practical: false,
      reasonIfNot: `Outdoor pollution (${airQuality.category.label}) is too elevated for unmasked walking or cycling commutes.`,
    };
  }
  if (profile.commuteDistanceKm > MAX_PRACTICAL_ACTIVE_COMMUTE_KM) {
    return {
      practical: false,
      reasonIfNot: `Commute distance (${profile.commuteDistanceKm} km each way) exceeds practical everyday walking/cycling range for most households.`,
    };
  }
  if (
    profile.sensitivityGroup !== 'general' &&
    (level === 'sensitive' || airQuality.aqi === null)
  ) {
    return {
      practical: false,
      reasonIfNot:
        'Sensitive household members should avoid prolonged roadside exertion when air quality is sensitive or unverified.',
    };
  }
  return { practical: true, reasonIfNot: '' };
}

export function buildDeterministicAlternatives(
  profile: UserProfile,
  airQuality: AirQualityContext
): AlternativeComparison[] {
  const alternatives: AlternativeComparison[] = [];
  const activeCheck = isActiveCommutePractical(profile, airQuality);

  if (profile.commuteMode === 'car_solo') {
    const estimate = estimateWeeklyTripReductionRange(profile.commuteDistanceKm, 2);

    alternatives.push({
      id: 'alt-commute-transit',
      domain: 'Daily Commute',
      currentChoice: `Solo car commute (${profile.commuteDistanceKm} km each way)`,
      alternativeChoice: activeCheck.practical
        ? 'Walk or cycle on low-traffic side streets, or take public transit on hazy days'
        : 'Public transit or 2–3 person carpool 2 days/week',
      practicality: profile.commuteDistanceKm <= 15 ? 'High' : 'Moderate',
      environmentalReasoning:
        'Consolidating trips onto shared transit or multi-occupancy vehicles cuts per-person fuel combustion and reduces winter traffic idling.',
      estimatedImpact: `Est. ${estimate.kmReduced} solo km avoided/week (~${estimate.transitNetSavingsRange[0]}–${estimate.transitNetSavingsRange[1]} kg CO2e saved/week)`,
      assumptions:
        `Calculated for 2 round-trips/week using average urban passenger car (${EMISSION_ASSUMPTIONS.carSoloKgCo2PerKmLow}–${EMISSION_ASSUMPTIONS.carSoloKgCo2PerKmHigh} kg CO2e/km) vs urban transit (${EMISSION_ASSUMPTIONS.publicTransitKgCo2PerKmLow}–${EMISSION_ASSUMPTIONS.publicTransitKgCo2PerKmHigh} kg CO2e/km).`,
      tradeOffs:
        'May add 10–25 minutes per trip depending on transfers and winter schedules.',
      whenNotSuitable:
        activeCheck.reasonIfNot ||
        'Not suitable if transit requires long outdoor waits in sub-freezing hazardous smog without a well-fitting particulate mask, or if caregiving/mobility needs require direct vehicle access.',
    });
  } else if (profile.commuteMode === 'walk_cycle' && !activeCheck.practical) {
    alternatives.push({
      id: 'alt-active-to-transit',
      domain: 'High-Smog Commute Shift',
      currentChoice: `Walking/cycling commute (${profile.commuteDistanceKm} km each way)`,
      alternativeChoice: 'Switch temporarily to covered public transit or carpool during severe smog',
      practicality: 'High',
      environmentalReasoning:
        'Keeps personal tailpipe emissions low while avoiding elevated breathing rates directly beside winter road exhaust.',
      estimatedImpact:
        'Lower inhaled particle dose compared to unmasked roadside exertion; minimal added per-person emissions via shared transit',
      assumptions:
        'Applies when outdoor AQI exceeds Unhealthy thresholds or when sensitive respiratory conditions apply.',
      tradeOffs: 'Standard transit fare and slight schedule adjustment vs direct door-to-door cycling.',
      whenNotSuitable:
        'Not necessary on Good/Moderate days when quiet side-street routes are safe and comfortable.',
    });
  } else {
    alternatives.push({
      id: 'alt-errand-consolidation',
      domain: 'Household Errands',
      currentChoice: 'Separate ad-hoc vehicle or delivery trips throughout the week',
      alternativeChoice: 'Single weekly batched errand route or consolidated neighborhood delivery window',
      practicality: 'High',
      environmentalReasoning:
        'Fewer individual stops and cold engine starts reduce cumulative street-level NO2 and particulate emissions.',
      estimatedImpact: 'Lower cold-start exhaust per trip loop (exact savings depend on vehicle & route)',
      assumptions:
        'Assumes errands can be grouped within one geographic corridor without extra detours.',
      tradeOffs: 'Requires 15 minutes of weekly list planning and larger carrying bags.',
      whenNotSuitable:
        'Not suitable for urgent pharmacy/medical needs or heavy items when carrying safely is impractical.',
    });
  }

  alternatives.push({
    id: 'alt-heating-cooking',
    domain: 'Indoor Cooking & Heating',
    currentChoice:
      profile.cookingFuel === 'solid_fuel_wood'
        ? 'Solid fuel / wood-based cooking or supplemental indoor burning'
        : profile.cookingFuel === 'gas_stove'
          ? 'Unvented or partially vented gas burner cooking'
          : 'High-heat indoor frying without active extraction',
    alternativeChoice:
      profile.cookingFuel === 'solid_fuel_wood'
        ? 'Electric kettle, induction hotplate, or pressure cooker for daily staples'
        : 'Electric/induction appliances for simmering + covered pots + active exhaust hood',
    practicality: 'High',
    environmentalReasoning:
      'Eliminating or extracting indoor combustion directly prevents nitrogen dioxide and fine soot from accumulating in closed winter rooms.',
    estimatedImpact: 'Substantial reduction in indoor combustion spikes (PM2.5 & NO2) when vented or switched to electric',
    assumptions:
      'Assumes reliable household electricity access and compatible cookware.',
    tradeOffs:
      'Small upfront cost if purchasing a portable induction burner or electric kettle.',
    whenNotSuitable:
      'Not suitable during grid outages or when household electrical wiring cannot support high-wattage appliances.',
  });

  alternatives.push({
    id: 'alt-hybrid-meeting',
    domain: 'Work & Study Attendance',
    currentChoice: 'In-person attendance on severe winter inversion days',
    alternativeChoice:
      profile.workSchedule === 'flexible_hybrid' || profile.workSchedule === 'home_based'
        ? 'Shift peak-smog days to remote work / virtual classes'
        : 'Request temporary remote participation or staggered off-peak arrival on high-AQI alerts',
    practicality:
      profile.workSchedule === 'flexible_hybrid' || profile.workSchedule === 'home_based'
        ? 'High'
        : 'Situational',
    environmentalReasoning:
      'Skipping a peak-hour commute simultaneously lowers your personal traffic-corridor exposure and removes one vehicle from congested winter roads.',
    estimatedImpact:
      profile.commuteDistanceKm > 0
        ? `Avoids ${profile.commuteDistanceKm * 2} km of round-trip commuting on each remote day`
        : 'Eliminates daily peak-hour transit exposure on remote days',
    assumptions:
      'Assumes employer/school permits remote participation and home electricity/heating is already active.',
    tradeOffs:
      'Requires workspace at home and coordination with teammates or teachers.',
    whenNotSuitable:
      'Not suitable for hands-on clinical, retail, manufacturing, or essential in-person roles.',
  });

  return alternatives;
}
