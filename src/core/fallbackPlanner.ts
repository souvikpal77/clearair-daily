import type {
  AirQualityContext,
  StructuredAssistantReply,
  UserProfile,
} from '../shared/types.ts';
import {
  buildActionChecklist,
  buildDeterministicPlan,
} from './dailyPlanGenerator.ts';

export { buildActionChecklist, buildDeterministicPlan };

const MEDICAL_SCOPE_REGEX =
  /\b(diagnos\w*|asthma attack|inhaler|medication|steroid|prescrib\w*|prescription|chest pain|shortness of breath|wheezing|cure|treat\w*|disease|antibiotic|symptom\w*|medical advice|clinical)\b/i;

const AQI_QUERY_REGEX =
  /\b(what is my aqi|tell me my aqi|current aqi|air quality index|aqi value|live aqi|what's the aqi|how is the aqi|aqi is \d+|pm2\.5|pm10|air quality reading|pollution level)\b/i;

export function isMedicalScopeQuestion(question: string): boolean {
  return MEDICAL_SCOPE_REGEX.test(question);
}

export function isDirectAqiValueQuestion(question: string): boolean {
  return AQI_QUERY_REGEX.test(question);
}

export function formatStructuredAssistantReply(
  structured: StructuredAssistantReply
): string {
  const lines: string[] = [structured.answer.trim()];
  for (const rec of structured.recommendations) {
    lines.push(`• ${rec.trim()}`);
  }
  if (structured.impactExplanation.trim()) {
    lines.push(`• Direct impact: ${structured.impactExplanation.trim()}`);
  }
  if (structured.cautions.length > 0) {
    lines.push(`• Note: ${structured.cautions[0].trim()}`);
  }
  return lines.join('\n\n');
}

export function buildStructuredFallbackAssistantReply(
  question: string,
  profile: UserProfile,
  airQuality: AirQualityContext
): StructuredAssistantReply {
  const q = question.toLowerCase();
  const aqiText =
    airQuality.aqi !== null
      ? `${airQuality.aqi} (${airQuality.category.label}, ${airQuality.dataSource === 'live' ? 'live reading' : 'estimated scenario'})`
      : 'currently unavailable';

  if (isMedicalScopeQuestion(question)) {
    return {
      answer:
        'I can share practical environmental-exposure guidance, but I cannot diagnose health conditions, evaluate symptoms, or recommend medical treatments.',
      recommendations: [
        `For ${airQuality.cityResolved} (${aqiText}), keep indoor air cleaner by keeping windows closed during haze peaks and running available filtration.`,
        'Follow official local public-health advisories and consult a qualified healthcare clinician for respiratory symptoms or medication questions.',
      ],
      impactExplanation:
        'Reducing exposure to ambient PM2.5 and indoor combustion lowers irritant contact while clinical decisions remain with healthcare professionals.',
      cautions: [
        'Informational environmental guidance only (not medical advice) — seek prompt medical care for breathing difficulty or chest discomfort.',
      ],
    };
  }

  if (airQuality.aqi === null && isDirectAqiValueQuestion(question)) {
    return {
      answer: `I don't have a reliable current AQI value for your selected location (${airQuality.cityResolved}).`,
      recommendations: [
        'Treat outdoor air with standard winter precautions: avoid vigorous exercise next to busy roads until live readings load.',
        'Keep indoor combustion sources off and ventilate cooking fumes outside.',
      ],
      impactExplanation:
        'Using precautionary pacing prevents unverified high-exposure outdoor exertion while waiting for reliable local telemetry.',
      cautions: [
        'No live AQI value was available from upstream; check official local monitoring stations or try a planning scenario.',
      ],
    };
  }

  if (
    q.includes('commute') ||
    q.includes('travel') ||
    q.includes('drive') ||
    q.includes('transit')
  ) {
    return {
      answer: `For ${airQuality.cityResolved} under ${aqiText} conditions (current commute: ${profile.commuteMode.replace('_', ' ')}, ${profile.commuteDistanceKm} km each way):`,
      recommendations: [
        profile.commuteMode === 'car_solo'
          ? 'Switch 1–2 trips/week to public transit or carpooling when practical to avoid cold-start tailpipe exhaust; if driving, set cabin climate to recirculate in heavy traffic.'
          : 'Use quieter residential side streets away from heavy diesel corridors and minimize waiting time near idling vehicles.',
        'Combine errands into one warm-engine loop rather than separate short drives.',
      ],
      impactExplanation:
        'Fewer solo vehicle-kilometres directly reduce localized NO2 and fine particulate exhaust near residential roads.',
      cautions: [
        'Transport feasibility depends on local transit access, weather safety, and caregiving responsibilities.',
      ],
    };
  }

  if (
    q.includes('indoor') ||
    q.includes('cook') ||
    q.includes('window') ||
    q.includes('hepa') ||
    q.includes('filter')
  ) {
    const highOutdoor = airQuality.aqi === null || airQuality.aqi > 100;
    return {
      answer: `For your household of ${profile.householdSize} (${profile.cookingFuel.replace('_', ' ')}, ${profile.hasHepaFilter ? 'HEPA purifier available' : 'no standalone HEPA purifier'}) in ${airQuality.cityResolved} (${aqiText}):`,
      recommendations: [
        highOutdoor
          ? 'Keep windows closed during morning and evening winter inversion peaks; air rooms out briefly only if midday conditions improve.'
          : 'Conditions allow 15-minute cross-ventilation away from busy streets.',
        'Run your range hood during cooking, use lids on pots, and skip candles or incense indoors.',
        profile.hasHepaFilter
          ? 'Run your HEPA unit continuously on medium/quiet in the main sleeping room with the door closed.'
          : 'Designate one well-sealed bedroom for overnight rest without claiming unverified mechanical filtration benefits.',
      ],
      impactExplanation:
        'Capturing cooking combustion at the stove and reducing outdoor smog infiltration lowers cumulative indoor particle exposure.',
      cautions: [
        'Recirculating kitchen fans without outdoor venting filter grease better than NO2 combustion gases.',
      ],
    };
  }

  if (
    q.includes('family') ||
    q.includes('exposure') ||
    q.includes('child') ||
    q.includes('elderly') ||
    q.includes('health')
  ) {
    return {
      answer: `With ${airQuality.cityResolved} at ${aqiText} and household sensitivity set to "${profile.sensitivityGroup.replace('_', ' ')}":`,
      recommendations: [
        `Outdoor pacing: ${airQuality.category.outdoorMultiplier}.`,
        'Avoid rush-hour roadside walks (07:30–10:00 and 17:30–20:30), when traffic emissions and winter inversions overlap.',
      ],
      impactExplanation:
        'Shifting outdoor time away from peak inversion and roadside hours lowers inhaled fine particulate dose.',
      cautions: [
        'This guidance is informational only and not medical advice. Consult a clinician if anyone experiences breathing discomfort.',
      ],
    };
  }

  return {
    answer: `Based on your ${airQuality.cityResolved} context (${aqiText}, dominant pollutant: ${airQuality.dominantPollutant}):`,
    recommendations: [
      `Top exposure step: ${airQuality.category.shortGuidance}`,
      profile.commuteMode === 'car_solo'
        ? `Top emission step: Replace 1–2 solo ${profile.commuteDistanceKm} km car trips per week with transit, carpooling, or combined errands.`
        : 'Top emission step: Batch household errands into fewer warm-engine trips and keep indoor combustion sources off.',
    ],
    impactExplanation:
      'Cutting unnecessary tailpipe trips and indoor smoke sources simultaneously reduces both personal particle exposure and local emissions.',
    cautions: [
      'I cannot measure real-time indoor air inside your home or provide medical diagnoses; use the Daily Plan and Indoor Air sections for step-by-step routines.',
    ],
  };
}

export function buildFallbackAssistantReply(
  question: string,
  profile: UserProfile,
  airQuality: AirQualityContext
): string {
  return formatStructuredAssistantReply(
    buildStructuredFallbackAssistantReply(question, profile, airQuality)
  );
}
