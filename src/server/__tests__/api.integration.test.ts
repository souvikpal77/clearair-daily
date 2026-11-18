import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_PROFILE } from '../../shared/constants';
import { buildEstimatedScenarioContext, categorizeUsAqi } from '../../core/aqCategorizer';
import { buildDeterministicPlan } from '../../core/fallbackPlanner';
import { clearAirQualityCache, resolveAirQualityContext } from '../airQualityService';
import { createApiApp } from '../createApp';
import { askGroundedAssistant, generatePersonalizedPlan } from '../geminiService';

afterEach(() => {
  clearAirQualityCache();
  vi.restoreAllMocks();
});

async function withTestServer<T>(
  app: ReturnType<typeof createApiApp>,
  fn: (baseUrl: string) => Promise<T>
): Promise<T> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind ephemeral port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('airQualityService', () => {
  it('maps live Open-Meteo geocoding and AQ payloads accurately and caches/deduplicates requests', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                name: 'Warsaw',
                country: 'Poland',
                admin1: 'Masovia',
                latitude: 52.23,
                longitude: 21.01,
              },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          current: {
            time: '2026-11-18T12:00',
            us_aqi: 142,
            pm2_5: 52.4,
            pm10: 78.1,
            nitrogen_dioxide: 44.2,
            ozone: 31.0,
          },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const [first, second] = await Promise.all([
      resolveAirQualityContext('Warsaw', 'live', mockFetch),
      resolveAirQualityContext('Warsaw', 'live', mockFetch),
    ]);
    expect(first.dataSource).toBe('live');
    expect(first.confidence).toBe('high');
    expect(first.aqi).toBe(142);
    expect(first.category.level).toBe('sensitive');
    expect(first.cityResolved).toBe('Warsaw');
    expect(first.pollutants.find((p) => p.code === 'PM2.5')?.value).toBe(52.4);
    expect(second.aqi).toBe(142);
    // Deduplication means only 2 calls total (1 geocode + 1 AQ), not 4
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Explicit forceRefresh bypasses cache
    await resolveAirQualityContext('Warsaw', 'live', mockFetch, { forceRefresh: true });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('falls back to clearly labeled scenario_estimate on network failure, timeout, or malformed upstream payload', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('Network unavailable');
    }) as unknown as typeof fetch;

    const netFail = await resolveAirQualityContext('Warsaw', 'live', failingFetch);
    expect(netFail.dataSource).toBe('scenario_estimate');
    expect(netFail.confidence).toBe('estimated');
    expect(netFail.observedAt).toBeNull();
    expect(netFail.statusNote.toLowerCase()).toContain('estimated');

    clearAirQualityCache();
    const abortingFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    ) as unknown as typeof fetch;

    const timedOut = await resolveAirQualityContext('Milan', 'live', abortingFetch, {
      timeoutMs: 15,
    });
    expect(timedOut.dataSource).toBe('scenario_estimate');

    clearAirQualityCache();
    const malformedFetch = vi.fn(async () => new Response('not-json', { status: 500 })) as unknown as typeof fetch;
    const serverErr = await resolveAirQualityContext('Seoul', 'live', malformedFetch);
    expect(serverErr.dataSource).toBe('scenario_estimate');
  });
});

describe('geminiService resilience & validation', () => {
  it('accepts valid Gemini structured plan & structured chat output while keeping deterministic recommendations authoritative', async () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'severe_winter_inversion');
    const sampleValidPayload = buildDeterministicPlan(DEFAULT_USER_PROFILE, aq);
    sampleValidPayload.summary = 'Gemini-personalized severe winter inversion plan for Delhi family.';

    const sampleChatJson = {
      answer: 'Delhi is currently at US AQI 225 (Very Unhealthy, estimated scenario).',
      recommendations: [
        'Shift outdoor workouts indoors and keep windows latched.',
        'Run kitchen exhaust while cooking on your gas stove.',
      ],
      impactExplanation: 'Closing exterior windows and running exhaust lowers indoor particle peaks.',
      cautions: ['Informational guidance only — not medical advice.'],
    };

    const mockAdapter = {
      generateStructuredPlan: vi.fn(async () => JSON.stringify(sampleValidPayload)),
      generateChatReply: vi.fn(async () => JSON.stringify(sampleChatJson)),
    };

    const result = await generatePersonalizedPlan(DEFAULT_USER_PROFILE, aq, mockAdapter);
    expect(result.generationMode).toBe('gemini_personalized');
    expect(result.fallbackNotice).toBeNull();
    expect(result.plan.summary).toContain('Gemini-personalized');
    expect(result.recommendations?.[0].priority).toBe('critical');

    const chatRes = await askGroundedAssistant(
      {
        question: 'How should I handle indoor air today?',
        history: [],
        profile: DEFAULT_USER_PROFILE,
        airQuality: aq,
      },
      mockAdapter
    );
    expect(chatRes.mode).toBe('gemini_grounded');
    expect(chatRes.structuredReply?.recommendations.length).toBe(2);
    expect(chatRes.reply).toContain('Delhi');
  });

  it('falls back gracefully when Gemini returns malformed JSON or incomplete schema for plan or chat', async () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze');
    const malformedAdapter = {
      generateStructuredPlan: vi.fn(async () => '{"summary": "broken"'),
      generateChatReply: vi.fn(async () => '{"answer": "incomplete"}'),
    };

    const result = await generatePersonalizedPlan(DEFAULT_USER_PROFILE, aq, malformedAdapter);
    expect(result.generationMode).toBe('deterministic_fallback');
    expect(result.fallbackNotice).toBeTruthy();
    expect(result.plan.dailyPlan.length).toBeGreaterThanOrEqual(5);

    const chatRes = await askGroundedAssistant(
      {
        question: 'What should I do indoors?',
        history: [],
        profile: DEFAULT_USER_PROFILE,
        airQuality: aq,
      },
      malformedAdapter
    );
    expect(chatRes.mode).toBe('deterministic_fallback');
    expect(chatRes.structuredReply?.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back gracefully on Gemini timeout and on 429 RESOURCE_EXHAUSTED', async () => {
    const aq = buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze');
    const slowAdapter = {
      generateStructuredPlan: vi.fn(
        () => new Promise<string>(() => {})
      ),
      generateChatReply: vi.fn(
        () => new Promise<string>(() => {})
      ),
    };

    const timeoutPlan = await generatePersonalizedPlan(DEFAULT_USER_PROFILE, aq, slowAdapter, {
      timeoutMs: 15,
    });
    expect(timeoutPlan.generationMode).toBe('deterministic_fallback');
    expect(timeoutPlan.plan.dailyPlan.length).toBeGreaterThanOrEqual(5);

    const timeoutChat = await askGroundedAssistant(
      {
        question: 'How should I plan my commute?',
        history: [],
        profile: DEFAULT_USER_PROFILE,
        airQuality: aq,
      },
      slowAdapter,
      { timeoutMs: 15 }
    );
    expect(timeoutChat.mode).toBe('deterministic_fallback');
    expect(timeoutChat.reply).toContain('Delhi');

    const rateLimitedAdapter = {
      generateStructuredPlan: vi.fn(async () => {
        throw new Error('429 RESOURCE_EXHAUSTED');
      }),
      generateChatReply: vi.fn(async () => {
        throw new Error('429 RESOURCE_EXHAUSTED');
      }),
    };

    const planRes = await generatePersonalizedPlan(DEFAULT_USER_PROFILE, aq, rateLimitedAdapter);
    expect(planRes.generationMode).toBe('deterministic_fallback');
    expect(planRes.fallbackNotice).toContain('rate-limited');

    const chatRes = await askGroundedAssistant(
      {
        question: 'How should I plan my commute today?',
        history: [],
        profile: DEFAULT_USER_PROFILE,
        airQuality: aq,
      },
      rateLimitedAdapter
    );
    expect(chatRes.mode).toBe('deterministic_fallback');
    expect(chatRes.reply).toContain('Delhi');
  });

  it('enforces missing AQI guardrail even when Gemini adapter is present', async () => {
    const missingAq = {
      ...buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze'),
      aqi: null,
      category: categorizeUsAqi(null),
    };
    const mockAdapter = {
      generateStructuredPlan: vi.fn(),
      generateChatReply: vi.fn(async () =>
        JSON.stringify({
          answer: 'AQI is 999',
          recommendations: ['Stay inside'],
          impactExplanation: 'Test',
          cautions: ['Test'],
        })
      ),
    };

    const chatRes = await askGroundedAssistant(
      {
        question: 'What is my AQI?',
        history: [],
        profile: DEFAULT_USER_PROFILE,
        airQuality: missingAq,
      },
      mockAdapter
    );
    expect(mockAdapter.generateChatReply).not.toHaveBeenCalled();
    expect(chatRes.reply).toContain("don't have a reliable current AQI value");
  });
});

describe('Express API endpoints', () => {
  it('returns 400 on invalid /api/air-quality city and 200 on scenario lookup', async () => {
    const app = createApiApp({ geminiAdapter: null });
    await withTestServer(app, async (baseUrl) => {
      const badRes = await fetch(`${baseUrl}/api/air-quality?city=a`);
      expect(badRes.status).toBe(400);

      const okRes = await fetch(
        `${baseUrl}/api/air-quality?city=Seoul&scenario=severe_winter_inversion`
      );
      expect(okRes.status).toBe(200);
      const data = await okRes.json();
      expect(data.cityResolved).toBe('Seoul');
      expect(data.dataSource).toBe('scenario_estimate');
    });
  });

  it('validates /api/plan/generate and /api/assistant/chat payloads', async () => {
    const app = createApiApp({ geminiAdapter: null });
    const aq = buildEstimatedScenarioContext('Milan', 'moderate_winter_haze');

    await withTestServer(app, async (baseUrl) => {
      const invalidPlan = await fetch(`${baseUrl}/api/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { city: 'X' } }),
      });
      expect(invalidPlan.status).toBe(400);

      const validPlan = await fetch(`${baseUrl}/api/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: DEFAULT_USER_PROFILE, airQuality: aq }),
      });
      expect(validPlan.status).toBe(200);
      const planJson = await validPlan.json();
      expect(planJson.generationMode).toBe('deterministic_fallback');
      expect(planJson.checklist.length).toBe(6);
      expect(planJson.recommendations.length).toBeGreaterThanOrEqual(3);

      const chatRes = await fetch(`${baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'What can I do indoors?',
          history: [],
          profile: DEFAULT_USER_PROFILE,
          airQuality: aq,
        }),
      });
      expect(chatRes.status).toBe(200);
      const chatJson = await chatRes.json();
      expect(chatJson.reply.length).toBeGreaterThan(20);
      expect(chatJson.structuredReply.answer.length).toBeGreaterThan(10);
    });
  });
});
