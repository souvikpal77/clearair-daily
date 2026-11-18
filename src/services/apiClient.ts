import type {
  AirQualityContext,
  AssistantChatResponse,
  GeneratedAirPlanResponse,
  PlanningScenarioId,
  UserProfile,
} from '../shared/types.ts';

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMessage =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiClientError(serverMessage, response.status);
  }
  return payload as T;
}

export async function fetchAirQuality(
  city: string,
  scenario: PlanningScenarioId = 'live',
  signal?: AbortSignal,
  forceRefresh = false
): Promise<AirQualityContext> {
  const params = new URLSearchParams({
    city: city.trim(),
    scenario,
    ...(forceRefresh ? { refresh: 'true' } : {}),
  });
  const response = await fetch(`/api/air-quality?${params.toString()}`, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  });
  return parseJsonOrThrow<AirQualityContext>(response);
}

export async function requestPersonalizedPlan(
  profile: UserProfile,
  airQuality: AirQualityContext,
  signal?: AbortSignal
): Promise<GeneratedAirPlanResponse> {
  const response = await fetch('/api/plan/generate', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ profile, airQuality }),
  });
  return parseJsonOrThrow<GeneratedAirPlanResponse>(response);
}

export async function sendAssistantQuestion(
  params: {
    question: string;
    history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
    profile: UserProfile;
    airQuality: AirQualityContext;
    planSummary?: string;
  },
  signal?: AbortSignal
): Promise<AssistantChatResponse> {
  const response = await fetch('/api/assistant/chat', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow<AssistantChatResponse>(response);
}
