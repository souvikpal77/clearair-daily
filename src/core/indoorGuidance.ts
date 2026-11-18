import type {
  AirQualityContext,
  IndoorGuidanceItem,
  UserProfile,
} from '../shared/types.ts';
import { US_EPA_AQI_THRESHOLDS } from './aqCategorizer.ts';

export function buildDeterministicIndoorGuidance(
  profile: UserProfile,
  airQuality: AirQualityContext
): IndoorGuidanceItem[] {
  const items: IndoorGuidanceItem[] = [];
  const aqi = airQuality.aqi;
  const isMissingAqi = aqi === null;
  const highOutdoorPollution = isMissingAqi || aqi > US_EPA_AQI_THRESHOLDS.moderateMax;

  // 1. Evidence-based: Cooking ventilation
  if (profile.cookingFuel === 'gas_stove') {
    const usesWindowsOnly = profile.ventilationType === 'windows_only';
    items.push({
      id: 'indoor-cooking-gas',
      area: 'Cooking',
      title: usesWindowsOnly
        ? 'Ventilate kitchen briefly during gas cooking'
        : 'Ventilate gas burners before ignition',
      guidance: usesWindowsOnly
        ? 'Because you rely on window ventilation, crack the nearest kitchen window, cook with pot lids on back burners, and close the window once cooking fumes clear.'
        : 'Turn on your range hood before lighting burners, cook on back burners (better hood capture), and run extraction for 10 minutes after cooking.',
      sourceType: 'evidence_based',
      rationale:
        'Gas combustion produces nitrogen dioxide (NO2) and ultrafine particles indoors; active extraction or brief targeted airing prevents buildup.',
      limitations: usesWindowsOnly
        ? 'When outdoor AQI is elevated, keep window opening brief and isolated to the kitchen to limit outdoor PM2.5 entry.'
        : 'Recirculating hoods without an outdoor duct capture grease and odors better than combustion NO2.',
    });
  } else if (profile.cookingFuel === 'solid_fuel_wood') {
    items.push({
      id: 'indoor-cooking-solid',
      area: 'Cooking',
      title: 'Eliminate unvented solid-fuel smoke indoors',
      guidance:
        'Avoid burning wood, coal, or biomass indoors; shift simmering/boiling to electric appliances or well-ventilated outdoor spaces when feasible.',
      sourceType: 'evidence_based',
      rationale:
        'Solid fuel combustion generates very high indoor PM2.5 and carbon monoxide concentrations that persist for hours in closed winter rooms.',
      limitations:
        'Switching cooking steps depends on reliable household electricity access and safe appliance availability.',
    });
  } else {
    items.push({
      id: 'indoor-cooking-electric',
      area: 'Cooking',
      title: 'Cover pans during high-heat electric cooking',
      guidance:
        'Use lids while boiling or searing and switch on your exhaust fan during oil-based frying to capture cooking aerosols.',
      sourceType: 'evidence_based',
      rationale:
        'Even without gas combustion, high-temperature oil aerosolizes fine PM2.5 droplets.',
      limitations:
        'Exhaust hoods should be kept clean so grease buildup does not restrict airflow.',
    });
  }

  // 2. Evidence-based: Ventilation timing
  if (highOutdoorPollution) {
    items.push({
      id: 'indoor-vent-sealed',
      area: 'Ventilation',
      title: isMissingAqi
        ? 'Use cautious window ventilation until live AQI resolves'
        : 'Keep exterior windows closed during inversion peaks',
      guidance: isMissingAqi
        ? 'Keep windows closed during rush-hour and evening smoke periods; air out rooms only briefly when outdoor air looks clear and local advisories permit.'
        : 'Keep windows latched during morning and evening smog buildup; if airing rooms for humidity/CO2 control, limit to brief 10–15 minute cross-ventilation only when local AQI dips.',
      sourceType: 'evidence_based',
      rationale:
        'Outdoor PM2.5 penetrates rapidly through open windows during temperature inversions, raising indoor exposure within minutes.',
      limitations:
        'Closing windows completely for long periods can raise indoor CO2 and moisture; brief off-peak airing helps balance indoor freshness.',
    });
  } else {
    items.push({
      id: 'indoor-vent-window',
      area: 'Ventilation',
      title: 'Use natural cross-ventilation during clean air hours',
      guidance:
        'Open opposite-side windows for 15–20 minutes away from busy street traffic to flush indoor CO2 and stale air.',
      sourceType: 'evidence_based',
      rationale:
        'When outdoor AQI is Good or Moderate, brief cross-ventilation refreshes indoor oxygen and lowers indoor pollutant accumulation.',
      limitations:
        'Avoid opening windows facing directly onto idling arterial traffic or nearby woodsmoke plumes.',
    });
  }

  // 3. Evidence-based: Combustion sources
  items.push({
    id: 'indoor-combustion-zero',
    area: 'Combustion',
    title: 'Pause candles, incense, and indoor smoking',
    guidance:
      'Skip scented candles, incense sticks, and wood fireplaces on hazy winter days, and damp-mop floors instead of dry sweeping.',
    sourceType: 'evidence_based',
    rationale:
      'Indoor burning adds fine soot directly into sealed winter rooms, while dry sweeping resuspends settled dust particles.',
    limitations:
      'Reduces indoor particle generation; does not remove fine particles already entering from outdoors.',
  });

  // 4. Tailored Filtration Guidance
  if (profile.hasHepaFilter) {
    items.push({
      id: 'indoor-hepa-active',
      area: 'Filtration',
      title: 'Keep HEPA purifier in main bedroom or family room',
      guidance: highOutdoorPollution
        ? 'Run your HEPA unit continuously on Medium/Auto with bedroom doors closed at night rather than cycling it off.'
        : 'Run your HEPA purifier on Low during sleeping hours and check pre-filter dust weekly.',
      sourceType: 'ai_personalized',
      rationale:
        'Continuous operation maintains lower particle concentration across sleeping hours; sealing the smaller bedroom volume boosts effective air changes per hour.',
      limitations:
        'Particle reduction depends on true-HEPA media integrity and matching Clean Air Delivery Rate (CADR) to room volume.',
    });
  } else if (profile.ventilationType === 'mechanical_hvac') {
    items.push({
      id: 'indoor-no-hepa',
      area: 'Filtration',
      title: 'Check central HVAC filter rating (MERV 13 if supported)',
      guidance:
        'Verify whether your central HVAC blower supports a MERV 13 filter and set recirculation gently during high-smog hours without making unsupported medical claims.',
      sourceType: 'ai_personalized',
      rationale:
        `Tailored to a ${profile.householdSize}-person household with mechanical HVAC and no standalone portable HEPA unit during ${airQuality.category.label.toLowerCase()} conditions.`,
      limitations:
        'Older HVAC blowers can overheat if fitted with overly restrictive filters; check manufacturer specifications first.',
    });
  } else {
    items.push({
      id: 'indoor-no-hepa',
      area: 'Filtration',
      title: 'Create a low-particle "clean room" zone',
      guidance:
        'Without a mechanical purifier, focus on source control and sealing: keep one sleeping room closed with door-bottom draft stoppers and avoid indoor smoke sources rather than assuming unverified filtration.',
      sourceType: 'ai_personalized',
      rationale:
        `Tailored to a ${profile.householdSize}-person household without a standalone HEPA unit during ${airQuality.category.label.toLowerCase()} conditions.`,
      limitations:
        'Draft sealing slows outdoor particle entry but cannot actively scrub particles already suspended indoors.',
    });
  }

  return items;
}
