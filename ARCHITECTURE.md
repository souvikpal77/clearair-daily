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
| **Input Surfaces** | Oversized payloads, control characters, XSS strings, invalid numeric ranges | Strict Zod schemas (`SafeShortTextSchema`, bounded integers/floats), `100kb` Express JSON limit, clean `400` responses, React JSX escaping (no `dangerouslySetInnerHTML`). |
| **Planning & Reasoning** | Prompt injection via city/question inputs; hallucinated AQI numbers or medical diagnoses | Untrusted inputs wrapped in `<user_profile>` / `<user_question>` delimiters inside `contents`, immutable `systemInstruction`, Zod validation (`AiPlanPayloadSchema`) of AI JSON output before rendering. |
| **Tool Execution & Fetch** | SSRF via user-supplied URLs or hanging external network calls | Fixed allowlisted Open-Meteo HTTPS URLs with `encodeURIComponent`, 4.5s `AbortController` timeout, Zod validation of upstream JSON responses. |
| **Memory & State** | Excessive PII collection or corrupt `localStorage` state | Minimal non-sensitive profile schema (no names, emails, addresses, or medical records), stateless API endpoints, Zod validation when hydrating from `localStorage`. |
| **Inter-System Communication** | API key leakage to client bundle; unhandled `429`/`404`/`5xx` upstream errors | `@google/genai` imported strictly in `src/server/geminiService.ts`, `GEMINI_API_KEY` read server-side only, controlled error messages, exponential backoff + deterministic fallback. |
