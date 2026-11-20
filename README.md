# ClearAir Daily — Urban Air Quality Decision Assistant

ClearAir Daily helps families and urban households navigate severe winter smog and urban air pollution with practical daily plans, indoor air guidance, low-emission routine alternatives, and transparent cause-and-effect impact explanations.

---

## Problem & Solution

During winter temperature inversions and urban pollution episodes, families often face confusing raw AQI numbers without knowing *when* to ventilate, *how* to adjust their commute safely, or *which* daily habits meaningfully lower emissions and inhalation exposure.

ClearAir Daily turns live regional air-quality telemetry (or clearly labeled planning scenarios) and minimal household lifestyle inputs into:

1. **Air Quality Context Brief** — US AQI severity category, dominant pollutant, data provenance, and plain-language guidance without fabricating sensor data.
2. **Direct Impact Explainer** — Prominent `Action → Physical Mechanism → Direct Impact` chains with explicit estimation assumptions.
3. **Personalized Daily Air Plan & Action Tracker** — Chronological window-by-window guidance (morning, commute, midday, afternoon, evening, sleep) and a browser-local daily habit checklist.
4. **Indoor Air Quality Assistant** — Separates established evidence-based guidance (range hood timing, zero indoor combustion, window sealing) from household-tailored recommendations.
5. **Sustainable Alternatives & Collective Perspective** — Compares current choices against lower-emission alternatives with trade-offs and suitability limits, plus an interactive neighborhood scaling calculator.
6. **Grounded Conversational Assistant** — Answers follow-up questions anchored strictly to the active city, air-quality readings, and household profile.

---

## Architecture Overview

- **Frontend (`src/`)**: React 19 + TypeScript + Tailwind CSS v4 SPA communicating exclusively with internal `/api/*` endpoints.
- **Deterministic Core (`src/core/`, `src/shared/`)**: Zod input/output schemas, US EPA AQI categorization, emissions/impact estimation ranges, indoor air rules, and a complete deterministic fallback planner.
- **Backend (`server.ts`, `src/server/`)**: Express server on port `3000` hosting:
  - `GET /api/health`
  - `GET /api/air-quality` — Server-side Open-Meteo Geocoding + Air Quality lookup (4.5s timeout, 5-minute TTL cache) with honest `scenario_estimate` fallback when live data is unavailable.
  - `POST /api/plan/generate` — Combines deterministic impact calculations with server-side `@google/genai` (`gemini-4-hydrogen`) structured JSON personalization, validated by Zod before returning.
  - `POST /api/assistant/chat` — Grounded Q&A via server-side Gemini with delimiter-isolated untrusted inputs and deterministic fallback.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed component diagrams, trust boundaries, and the Threat Summary Table.

---

## Setup & Prerequisites

- **Node.js**: `>= 22.14`
- **npm**: `>= 10`

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` for local development (never commit `.env` or real keys):

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional (falls back to deterministic engine if absent) | Server-side Gemini API key used exclusively in `src/server/geminiService.ts`. |
| `PORT` | Optional (default `3000`) | HTTP server listening port. |
| `NODE_ENV` | Optional | Set to `production` when serving the built `dist/` bundle via `npm start`. |

### 3. Run Locally

```bash
# Development (Express + Vite middleware on port 3000)
npm run dev

# Production build & start
npm run build
NODE_ENV=production npm start
```

---

## Testing & Verification

Automated checks run via **Vitest**, **ESLint**, **TypeScript**, and **Vite** (configured in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)):

```bash
# Run unit, integration, and UI tests (Vitest + React Testing Library)
npm test

# TypeScript typecheck
npm run typecheck

# ESLint check
npm run lint

# Production bundle check
npm run build
```

See [TESTING.md](./TESTING.md) for test coverage, mocked service boundaries, and manual end-to-end verification walkthroughs.

---

## Cloud Run Deployment & Secret Manager

ClearAir Daily is designed as a stateless full-stack container/Node service suitable for Google Cloud Run.

### Secret Manager Setup

Store the Gemini API key in Google Cloud Secret Manager rather than source code or client bundles:

```bash
gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic"

echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets versions add GEMINI_API_KEY \
  --data-file=-

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Deploy to Cloud Run

```bash
gcloud run deploy clearair-daily \
  --source . \
  --region=us-central1 \
  --port=3000 \
  --set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --allow-unauthenticated
```

Apply the Cloud Run service label:

```bash
gcloud run services update clearair-daily \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## Responsible AI & Data Honesty Limitations

- **Informational Only**: ClearAir Daily does not provide medical advice, diagnosis, or treatment. Individuals with asthma, cardiovascular conditions, or respiratory symptoms should consult qualified clinicians and follow local public-health advisories.
- **No Fabricated Live Data**: When Open-Meteo live telemetry is unreachable or a city cannot be resolved, the interface switches explicitly to an **Estimated Planning Scenario** labeled `Not Live Sensor Data`.
- **Transparent Estimates**: Commute emission savings use bounded per-kilometer ranges (`0.16–0.22 kg CO2e/km` solo passenger vehicle vs `0.04–0.08 kg CO2e/km` shared transit) and display assumptions alongside every figure.
- **Privacy Minimization**: No names, street addresses, account credentials, or personal health records are collected. Household preferences and the daily checklist remain in browser `localStorage`.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for full terms.
