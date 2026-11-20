# Testing & Verification Strategy

ClearAir Daily uses **Vitest** (`jsdom` environment) and **React Testing Library** to test deterministic domain logic, server API contracts, fallback resilience, and accessible UI workflows without calling live Gemini or external network APIs.

---

## 1. Automated Test Suites

Run the full test suite:

```bash
npm test
```

### Unit Tests (`src/core/__tests__/`)
- **`aqCategorizer.test.ts`**: Verifies US EPA AQI boundary classifications (`0–50`, `51–100`, `101–150`, `151–200`, `201–300`, `301+`), null/negative safety handling, dominant pollutant logic, and honest non-live scenario labeling.
- **`aqNormalizer.test.ts`**: Verifies external Open-Meteo geocoding & AQ normalization, rejection of `NaN`, `Infinity`, negative, and physically impossible values, preservation of external category labels, and missing-AQI fallback.
- **`recommendationEngine.test.ts`**: Verifies deterministic prioritization (`critical`, `high`, `medium`, `low`) across good/moderate/unhealthy/severe/missing air, commute modes, solid-fuel/gas cooking, time-of-day windows, and household sensitivity.
- **`alternativesEngine.test.ts`**: Verifies practical constraints blocking automatic walk/cycle recommendations under severe smog, long distances, or sensitive household conditions, plus trade-off/suitability metadata.
- **`impactCalculator.test.ts`**: Verifies `calculateTransportImpact`, `calculateTripReduction`, `calculateActivityImpact`, bounded weekly km & CO2e estimate calculations, zero/NaN/extreme input clamping, `Action → Mechanism → Direct Impact` limitations, and neighborhood scaling math.
- **`schemas.test.ts`**: Verifies control-character stripping, out-of-range rejection, valid structured AI payload validation, and malformed AI JSON rejection.
- **`fallbackPlanner.test.ts`**: Verifies normal, severe-smog, missing-AQI, and early-shift solid-fuel daily plans, evidence-based vs personalized indoor actions, missing-AQI `"don't have a reliable current AQI"` guardrail, and medical-scope boundary enforcement.
- **`formatters.test.ts`**: Verifies human-friendly data freshness labels (`Updated just now`, `Updated X min ago`, `Estimated planning scenario`) and structured 3-line `Today's Air Signal` generation.

### Integration Tests (`src/server/__tests__/`)
- **`api.integration.test.ts`**:
  - Mocks `fetch` to test live Open-Meteo geocoding + AQ mapping, in-flight request deduplication (including concurrent `forceRefresh` coalescing), 5-min TTL caching, `forceRefresh` cache bypass, and network/timeout/malformed failure fallbacks.
  - Mocks `GeminiClientAdapter` to test valid structured plan & chat JSON output, timeout fallback, malformed/incomplete JSON fallback, `429 RESOURCE_EXHAUSTED` fallback, `UPSTREAM_5XX` (`500 INTERNAL` / `503 UNAVAILABLE`) retry and fallback, missing-AQI/medical guardrails, delimiter-breakout prompt isolation, and secret/path non-leakage.
  - Spins up an ephemeral HTTP server with `createApiApp` to verify `400 Bad Request` strict query/body validation, `403` cross-origin blocking, `429` fixed-window rate limiting, security headers, and `200 OK` responses across `/api/air-quality`, `/api/plan/generate`, and `/api/assistant/chat`.

### UI Component & Accessibility Tests (`src/components/__tests__/`)
- **`App.test.tsx`**:
  - Verifies Air Quality Context & Decision Brief, radial AQI gauge, Today's Air Signal, Clean-Air Priorities, Direct Impact Explainer, Responsible AI disclaimer, and TopBar active `aria-current="page"` navigation updates.
  - Verifies inline city validation errors (`role="alert"`).
  - Verifies interactive daily action checklist toggling and progress updates.
  - Verifies `ProfileModal` `role="dialog"` open, Escape-key close, and household update persistence.
  - Verifies quick assistant prompt submission, question-input preservation on request failure, malformed/XSS-tainted `localStorage` recovery, and HTML escaping of assistant output.

---

## 2. Manual End-to-End Walkthrough

1. **Initial Load & Provenance Check**: Open the app; confirm an immediate plan renders and the Overview header states whether telemetry is `Live telemetry` or `Estimated planning scenario (not live data)`.
2. **City & Scenario Switching**: Enter a city (e.g., `Warsaw` or `Lahore`) in the sidebar and click **Check**; switch to `Scenario: Severe Winter Inversion` and confirm AQI updates to `225 (Very Unhealthy)` and recommendations shift indoors.
3. **Personalization Modal**: Click **Update Profile**, change commute mode or HEPA status, press **Save & Refresh Plan**, and verify the sidebar profile and daily plan update.
4. **Action Tracking**: Check off 2 items in **Daily Action Tracking** and reload the page; confirm progress persists for today's date in `localStorage`.
5. **Grounded Assistant**: Click `"How should I plan my commute today?"` and verify the reply references the active city and AQI without inventing external readings.
