# System Architecture & Security Model

## 1. Hybrid Deterministic + GenAI Architecture

ClearAir Daily separates deterministic environmental logic from generative natural-language personalization so the application remains accurate, testable, and resilient under API failures.

```
Browser SPA (React 19 + Tailwind CSS v4)
  ├── Local State & Persistence (localStorage: household profile + daily checklist)
  └── Typed API Client (/api/* over HTTPS)
         │
         ▼
Express Server (port 3000, 100kb JSON cap, security headers)
  ├── GET /api/air-quality
  │      ├── Zod Query Validation
  │      ├── 5-min TTL In-Memory Cache
  │      └── Fixed-Origin Open-Meteo Fetch (4.5s timeout) ──► fallback: Estimated Scenario
  ├── POST /api/plan/generate
  │      ├── Zod Input Validation
  │      ├── Deterministic Core (Impact Chains, Indoor Rules, Fallback Plan)
  │      └── Server-Side Gemini (gemini-4-hydrogen, JSON responseSchema)
  │             └── Zod Output Validation ──► fallback: Deterministic Plan
  └── POST /api/assistant/chat
         ├── Zod Input Validation & History Cap
         └── Grounded Gemini Chat (delimiter-isolated user input)
                └── fallback: Deterministic Grounded Responder
```

---

## 2. Responsibility Separation

| Layer | Directory | Responsibility |
|---|---|---|
| Shared Contracts | `src/shared/` | Strict domain types (`AirQualityData`, `StructuredRecommendation`, `StructuredAssistantReply`), Zod sanitization schemas, emission assumptions, and scenario constants. |
| Deterministic Core | `src/core/` | US EPA AQI categorization (`aqCategorizer`), external payload bounds validation (`aqNormalizer`), prioritized recommendation engine (`recommendationEngine`), impact calculator (`impactCalculator`), lifestyle alternatives (`alternativesEngine`), indoor air rules (`indoorGuidance`), and daily plan/fallback generator (`dailyPlanGenerator`, `fallbackPlanner`). |
| Server Services | `src/server/` | Deduplicated & cached Open-Meteo API service (`airQualityService`), timeout-protected & schema-validated `@google/genai` orchestration (`geminiService`), and Express router factory (`createApp`). |
| Client UI & State | `src/components/`, `src/hooks/`, `src/services/` | Presentational UI components, `useAirQualityPlanner` state reuse & `AbortController` management, typed `/api/*` client, and local persistence. |

---

## 3. Threat Summary Table

| Threat Zone | Identified Risk | Implemented Mitigation |
|---|---|---|
| **Input Surfaces** | Oversized payloads, control/bidi characters, query coercion, XSS strings, invalid numeric ranges | Strict Zod schemas (`SafeShortTextSchema`, `.strict()` payloads, bounded integers/floats), strict string-only query validation (`400`), `100kb` Express JSON limit, clean `400`/`413` responses, React JSX escaping (no `dangerouslySetInnerHTML`). |
| **Planning & Reasoning** | Prompt injection via city/question inputs; hallucinated AQI numbers, tampered severity, or medical diagnoses | Untrusted inputs JSON-serialized with `\u003c`/`\u003e` escaping inside `<user_profile>` / `<user_question>` delimiters, server-recomputed authoritative `categorizeUsAqi` & `identifyDominantPollutant`, immutable `systemInstruction`, `SafeAiTextSchema` rejecting HTML/script sinks before rendering. |
| **Tool Execution & Fetch** | SSRF via user-supplied URLs, redirect abuse, hanging external calls, unbounded cache/rate abuse | `assertAllowedUpstreamUrl` HTTPS allowlist (`open-meteo.com`), `redirect: 'error'`, 4.5s `AbortController` timeout, bounded 200-entry TTL cache, fixed-window per-IP rate limiting (`429`) with `trust proxy`. |
| **Memory & State** | Excessive PII/location retention or corrupt `localStorage` state | Minimal non-sensitive profile schema, exact lat/lng omitted from client `AirQualityContext` responses, stateless API endpoints, Zod validation (`UserProfileSchema`, `ChecklistStorageSchema`) when hydrating from `localStorage`. |
| **Inter-System Communication** | API key leakage to client bundle, cross-origin API calls, stack-trace leakage | `@google/genai` imported strictly in `src/server/geminiService.ts`, `GEMINI_API_KEY` read server-side only, same-origin `Origin` guard (`403`), API `Content-Security-Policy` + `no-store` headers, safe diagnostic codes, global `500` JSON handler. |
