import type {
  AirQualityContext,
  AqCategoryInfo,
  PlanningScenarioId,
  PollutantReading,
} from '../shared/types.ts';

/**
 * Centralized US EPA Air Quality Index (AQI) category breakpoints.
 * Source: US EPA AirNow Technical Assistance Document (0–500 AQI scale).
 * Values > 500 remain classified as Hazardous up to the physical upper validation cap (1000).
 */
export const US_EPA_AQI_THRESHOLDS = {
  maxValidAqi: 1000,
  goodMax: 50,
  moderateMax: 100,
  sensitiveMax: 150,
  unhealthyMax: 200,
  veryUnhealthyMax: 300,
} as const;

/**
 * Reference concentration thresholds (µg/m³) used to identify the primary driver
 * when multiple pollutants are reported simultaneously.
 * Based on US EPA 24-hour PM2.5 / PM10 and 1-hour NO2 / 8-hour O3 guidance bands.
 */
export const POLLUTANT_DOMINANCE_THRESHOLDS = {
  pm25ElevatedUgM3: 35,
  no2ElevatedUgM3: 80,
  pm10ElevatedUgM3: 100,
  o3ElevatedUgM3: 100,
} as const;

export function isElevatedPollutionLevel(level: AqCategoryInfo['level']): boolean {
  return (
    level === 'sensitive' ||
    level === 'unhealthy' ||
    level === 'very_unhealthy' ||
    level === 'hazardous'
  );
}

export function isUnhealthyOrWorseLevel(level: AqCategoryInfo['level']): boolean {
  return level === 'unhealthy' || level === 'very_unhealthy' || level === 'hazardous';
}

export function isVeryUnhealthyOrWorseLevel(level: AqCategoryInfo['level']): boolean {
  return level === 'very_unhealthy' || level === 'hazardous';
}

export function categorizeUsAqi(aqi: number | null): AqCategoryInfo {
  if (
    aqi === null ||
    !Number.isFinite(aqi) ||
    aqi < 0 ||
    aqi > US_EPA_AQI_THRESHOLDS.maxValidAqi
  ) {
    return {
      level: 'moderate',
      label: 'Unavailable (Precautionary)',
      shortGuidance:
        'Live AQI is unavailable. Follow standard winter indoor-ventilation precautions until local readings are confirmed.',
      badgeTone: 'amber',
      outdoorMultiplier: 'Prefer moderate-intensity activity until live conditions are verified',
    };
  }

  if (aqi <= US_EPA_AQI_THRESHOLDS.goodMax) {
    return {
      level: 'good',
      label: 'Good',
      shortGuidance:
        'Air quality is satisfactory with low particle buildup. Good window for normal outdoor routines and cross-ventilation.',
      badgeTone: 'green',
      outdoorMultiplier: 'Normal outdoor activity suitable for most households',
    };
  }

  if (aqi <= US_EPA_AQI_THRESHOLDS.moderateMax) {
    return {
      level: 'moderate',
      label: 'Moderate',
      shortGuidance:
        'Acceptable for most people, though prolonged intense outdoor exertion near busy roads may affect sensitive individuals.',
      badgeTone: 'amber',
      outdoorMultiplier: 'Prefer low-traffic routes; monitor unusually sensitive family members',
    };
  }

  if (aqi <= US_EPA_AQI_THRESHOLDS.sensitiveMax) {
    return {
      level: 'sensitive',
      label: 'Unhealthy for Sensitive Groups',
      shortGuidance:
        'Children, older adults, and people with respiratory sensitivities should shorten prolonged or heavy outdoor exertion.',
      badgeTone: 'orange',
      outdoorMultiplier: 'Shorten outdoor exertion and shift vigorous exercise indoors',
    };
  }

  if (aqi <= US_EPA_AQI_THRESHOLDS.unhealthyMax) {
    return {
      level: 'unhealthy',
      label: 'Unhealthy',
      shortGuidance:
        'Everyone may experience air-quality discomfort. Minimize prolonged outdoor exertion, keep windows closed during peak haze, and prioritize indoor air cleanliness.',
      badgeTone: 'red',
      outdoorMultiplier: 'Move workouts indoors; use well-fitting particulate masks if commuting outdoors',
    };
  }

  if (aqi <= US_EPA_AQI_THRESHOLDS.veryUnhealthyMax) {
    return {
      level: 'very_unhealthy',
      label: 'Very Unhealthy',
      shortGuidance:
        'Winter inversion or severe smog conditions. Avoid non-essential outdoor activity, seal drafts, and run available filtration.',
      badgeTone: 'purple',
      outdoorMultiplier: 'Avoid outdoor exertion; limit time outside to essential trips only',
    };
  }

  return {
    level: 'hazardous',
    label: 'Hazardous',
    shortGuidance:
      'Emergency air-quality conditions. Stay indoors with filtered air where possible and follow official local public-health advisories.',
    badgeTone: 'purple',
    outdoorMultiplier: 'Remain indoors; follow official local emergency advisories',
  };
}

export function identifyDominantPollutant(pollutants: readonly PollutantReading[]): string {
  const pm25 = pollutants.find((p) => p.code === 'PM2.5')?.value ?? null;
  const pm10 = pollutants.find((p) => p.code === 'PM10')?.value ?? null;
  const no2 = pollutants.find((p) => p.code === 'NO2')?.value ?? null;
  const o3 = pollutants.find((p) => p.code === 'O3')?.value ?? null;

  if (pm25 !== null && pm25 >= POLLUTANT_DOMINANCE_THRESHOLDS.pm25ElevatedUgM3) {
    return 'PM2.5 (Fine Particulate Matter)';
  }
  if (
    no2 !== null &&
    no2 >= POLLUTANT_DOMINANCE_THRESHOLDS.no2ElevatedUgM3 &&
    (pm25 === null || pm25 < POLLUTANT_DOMINANCE_THRESHOLDS.pm25ElevatedUgM3)
  ) {
    return 'NO2 (Traffic Nitrogen Dioxide)';
  }
  if (pm10 !== null && pm10 >= POLLUTANT_DOMINANCE_THRESHOLDS.pm10ElevatedUgM3) {
    return 'PM10 (Coarse Dust & Smoke)';
  }
  if (o3 !== null && o3 >= POLLUTANT_DOMINANCE_THRESHOLDS.o3ElevatedUgM3) {
    return 'O3 (Ground-Level Ozone)';
  }
  if (pm25 !== null) {
    return 'PM2.5 (Fine Particulate Matter)';
  }
  if (no2 !== null) {
    return 'NO2 (Traffic Nitrogen Dioxide)';
  }
  if (pm10 !== null) {
    return 'PM10 (Coarse Dust & Smoke)';
  }
  if (o3 !== null) {
    return 'O3 (Ground-Level Ozone)';
  }
  return 'Mixed Urban Particulate & Traffic Emissions';
}

const SCENARIO_PRESETS: Record<
  Exclude<PlanningScenarioId, 'live'>,
  {
    aqi: number;
    defaultStatusNote: string;
    pollutants: PollutantReading[];
  }
> = {
  clean_breeze_day: {
    aqi: 38,
    defaultStatusNote:
      'Showing the Clean Breeze Day planning scenario. Values are illustrative estimates for routine planning, not live readings.',
    pollutants: [
      { code: 'PM2.5', name: 'Fine Particulate Matter', value: 9.2, unit: 'µg/m³', note: 'Estimated scenario value' },
      { code: 'PM10', name: 'Coarse Particulate Matter', value: 19.5, unit: 'µg/m³', note: 'Estimated scenario value' },
      { code: 'NO2', name: 'Nitrogen Dioxide', value: 18.0, unit: 'µg/m³', note: 'Estimated scenario value' },
      { code: 'O3', name: 'Ozone', value: 44.0, unit: 'µg/m³', note: 'Estimated scenario value' },
    ],
  },
  severe_winter_inversion: {
    aqi: 225,
    defaultStatusNote:
      'Showing the Severe Winter Inversion planning scenario. Values are illustrative estimates for preparedness planning, not live readings.',
    pollutants: [
      { code: 'PM2.5', name: 'Fine Particulate Matter', value: 148.0, unit: 'µg/m³', note: 'Estimated winter inversion value' },
      { code: 'PM10', name: 'Coarse Particulate Matter', value: 215.0, unit: 'µg/m³', note: 'Estimated winter inversion value' },
      { code: 'NO2', name: 'Nitrogen Dioxide', value: 96.0, unit: 'µg/m³', note: 'Estimated winter inversion value' },
      { code: 'O3', name: 'Ozone', value: 28.0, unit: 'µg/m³', note: 'Typically suppressed in dense winter smog' },
    ],
  },
  moderate_winter_haze: {
    aqi: 128,
    defaultStatusNote:
      'Showing the Moderate Winter Haze planning scenario. Values are illustrative estimates, not live sensor readings.',
    pollutants: [
      { code: 'PM2.5', name: 'Fine Particulate Matter', value: 46.5, unit: 'µg/m³', note: 'Estimated winter haze value' },
      { code: 'PM10', name: 'Coarse Particulate Matter', value: 84.0, unit: 'µg/m³', note: 'Estimated winter haze value' },
      { code: 'NO2', name: 'Nitrogen Dioxide', value: 58.0, unit: 'µg/m³', note: 'Estimated winter haze value' },
      { code: 'O3', name: 'Ozone', value: 36.0, unit: 'µg/m³', note: 'Estimated winter haze value' },
    ],
  },
};

export function buildEstimatedScenarioContext(
  city: string,
  scenarioId: Exclude<PlanningScenarioId, 'live'>,
  reasonOverride?: string
): AirQualityContext {
  const normalizedCity = city.trim() || 'Your City';
  const preset = SCENARIO_PRESETS[scenarioId];
  const pollutants = preset.pollutants.map((reading) => ({ ...reading }));

  return {
    cityResolved: normalizedCity,
    countryOrRegion: 'Estimated Planning Scenario',
    latitude: null,
    longitude: null,
    aqi: preset.aqi,
    category: categorizeUsAqi(preset.aqi),
    dominantPollutant: identifyDominantPollutant(pollutants),
    pollutants,
    observedAt: null,
    dataSource: 'scenario_estimate',
    provider: 'ClearAir Scenario Planner (Not Live Sensor Data)',
    confidence: 'estimated',
    statusNote: reasonOverride ?? preset.defaultStatusNote,
    scenarioId,
  };
}
