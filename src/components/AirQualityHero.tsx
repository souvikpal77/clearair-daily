import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  buildTodaysAirSignals,
  formatDataFreshness,
  type AirSignalItem,
} from '../core/formatters.ts';
import { getTimeOfDayGreeting, SEVERITY_TOKENS } from '../design/severityTheme.ts';
import type { AirQualityContext, ImpactChain, UserProfile } from '../shared/types.ts';
import { AirQualityGauge, StatusBadge } from './ui/Primitives.tsx';

interface AirQualityHeroProps {
  airQuality: AirQualityContext;
  profile: UserProfile;
  primaryImpact?: ImpactChain;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const POLLUTANT_GUIDELINES: Record<string, { refMax: number; label: string }> = {
  'PM2.5': { refMax: 75, label: 'Fine particles' },
  PM10: { refMax: 150, label: 'Coarse dust' },
  NO2: { refMax: 100, label: 'Traffic gas' },
  O3: { refMax: 120, label: 'Ozone' },
};

const SIGNAL_STYLES: Record<
  AirSignalItem['statusLevel'],
  { rowBg: string; dotBg: string; text: string; icon: typeof CheckCircle2 }
> = {
  alert: {
    rowBg: 'border-rose-200/90 bg-rose-50/75',
    dotBg: 'bg-rose-600',
    text: 'text-rose-950',
    icon: ShieldAlert,
  },
  caution: {
    rowBg: 'border-amber-200/90 bg-amber-50/75',
    dotBg: 'bg-amber-500',
    text: 'text-amber-950',
    icon: AlertTriangle,
  },
  positive: {
    rowBg: 'border-emerald-200/90 bg-emerald-50/70',
    dotBg: 'bg-emerald-600',
    text: 'text-emerald-950',
    icon: CheckCircle2,
  },
};

export function AirQualityHero({
  airQuality,
  profile,
  primaryImpact,
  isLoading,
  error,
  onRetry,
}: AirQualityHeroProps) {
  const tokens = SEVERITY_TOKENS[airQuality.category.level];
  const greeting = getTimeOfDayGreeting();
  const isEstimated = airQuality.dataSource === 'scenario_estimate';
  const freshness = formatDataFreshness(airQuality.observedAt, airQuality.dataSource);
  const signals = buildTodaysAirSignals(airQuality, profile);

  return (
    <section
      id="overview"
      aria-labelledby="hero-greeting-heading"
      className={`scroll-mt-20 relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br ${tokens.heroGlowClass} p-5 sm:p-6 shadow-[var(--shadow-elevated)]`}
    >
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 rounded"
          >
            Retry lookup
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left: Where am I? + Compact Greeting + Signature "Today's Air Signal" */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-teal-800">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{airQuality.cityResolved}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{airQuality.countryOrRegion}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{freshness.label}</span>
              </span>
            </div>

            <p className="mt-2.5 text-xs font-semibold tracking-wide text-slate-500">
              {greeting}
            </p>
            <h1
              id="hero-greeting-heading"
              className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px] sm:leading-[1.18]"
            >
              Let’s plan a cleaner day in {airQuality.cityResolved}.
            </h1>
          </div>

          {/* Signature Branded Component: TODAY'S AIR SIGNAL */}
          <div
            aria-label="Today's Air Signal"
            className="rounded-xl border border-[var(--border-subtle)] bg-white/90 p-4 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <p className="text-[11px] font-bold tracking-wider text-teal-900 uppercase">
                Today’s Air Signal
              </p>
              <span className="text-[11px] font-medium text-slate-500">
                Quick decision summary
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {signals.map((sig) => {
                const st = SIGNAL_STYLES[sig.statusLevel];
                const Icon = st.icon;
                return (
                  <li
                    key={sig.id}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs ${st.rowBg}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${st.dotBg}`}
                    />
                    <Icon className={`h-4 w-4 shrink-0 ${st.text}`} aria-hidden="true" />
                    <span className={`font-semibold ${st.text}`}>
                      <span className="text-slate-600 font-medium">{sig.domain}: </span>
                      {sig.actionLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isLoading ? 'Refreshing…' : 'Refresh Air Quality'}</span>
            </button>
            <span className="truncate">Source: {airQuality.provider}</span>
          </div>
        </div>

        {/* Right: Dominant Radial AQI Visualization + Structured Decision Brief */}
        <div className="lg:col-span-7 flex">
          <div
            className={`flex w-full flex-col justify-between rounded-2xl border bg-white/95 p-5 shadow-sm ${tokens.surfaceBorder}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold tracking-wider text-slate-600 uppercase">
                Air Quality Context & Decision Brief
              </h2>
              <StatusBadge
                level={airQuality.category.level}
                labelOverride={airQuality.category.label}
              />
            </div>

            {isLoading ? (
              <div
                className="my-auto py-8 space-y-4"
                aria-busy="true"
                aria-label="Loading air quality context"
              >
                <div className="grid gap-5 sm:grid-cols-12 items-center">
                  <div className="sm:col-span-5 mx-auto h-32 w-40 animate-pulse rounded-full bg-slate-100" />
                  <div className="sm:col-span-7 space-y-2.5">
                    <div className="h-5 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-5 w-5/6 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-14 animate-pulse rounded-lg bg-slate-100" />
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-5 sm:grid-cols-12 sm:items-center">
                  {/* Radial AQI Gauge Focal Point */}
                  <div className="sm:col-span-5 flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-[var(--surface-elevated)] p-3.5 text-center">
                    <AirQualityGauge
                      aqi={airQuality.aqi}
                      level={airQuality.category.level}
                      categoryLabel={airQuality.category.label}
                      isEstimated={isEstimated}
                    />
                    <p className={`mt-1.5 text-xs font-semibold leading-snug ${tokens.accentText}`}>
                      {tokens.headlineAdvice}
                    </p>
                  </div>

                  {/* Structured 5-Part Decision Brief */}
                  <dl className="sm:col-span-7 space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg border border-slate-200/80 bg-[var(--surface-elevated)] px-3 py-2">
                        <dt className="text-[11px] font-semibold text-slate-500">
                          Current condition
                        </dt>
                        <dd className={`mt-0.5 text-sm font-bold ${tokens.accentText}`}>
                          {airQuality.category.label}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-slate-200/80 bg-[var(--surface-elevated)] px-3 py-2">
                        <dt className="text-[11px] font-semibold text-slate-500">
                          Main pollutant
                        </dt>
                        <dd className="mt-0.5 text-sm font-bold text-slate-900 truncate">
                          {airQuality.dominantPollutant.split(' ')[0]}
                        </dd>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                      <dt className="text-[11px] font-semibold text-slate-500">What this means</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-slate-800">
                        {airQuality.category.shortGuidance}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-teal-200/80 bg-teal-50/45 px-3 py-2">
                      <dt className="text-[11px] font-semibold text-teal-900">
                        Today’s recommendation
                      </dt>
                      <dd className="mt-0.5 text-xs font-semibold text-slate-900">
                        {airQuality.category.outdoorMultiplier}
                      </dd>
                    </div>

                    {primaryImpact && (
                      <div className="rounded-lg border border-sky-200/80 bg-sky-50/45 px-3 py-2">
                        <dt className="text-[11px] font-semibold text-sky-900">Why it matters</dt>
                        <dd className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] leading-snug text-slate-800">
                          <span className="font-medium">{primaryImpact.title}</span>
                          <ArrowRight className="h-3 w-3 text-sky-700 shrink-0" aria-hidden="true" />
                          <span>{primaryImpact.directImpact}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Compact 4-Column Pollutant Strip */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3.5 sm:grid-cols-4">
                  {airQuality.pollutants.map((p) => {
                    const guide = POLLUTANT_GUIDELINES[p.code];
                    const fillPct =
                      p.value !== null && guide
                        ? Math.min(100, Math.max(6, Math.round((p.value / guide.refMax) * 100)))
                        : 0;
                    return (
                      <div
                        key={p.code}
                        className="rounded-lg border border-slate-200/80 bg-[var(--surface-elevated)] px-3 py-2"
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-xs font-bold text-slate-800">{p.code}</span>
                          <span className="text-[11px] font-semibold text-slate-900 font-mono-tabular">
                            {p.value !== null ? `${p.value} ${p.unit}` : 'Unavailable'}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/75">
                          <div
                            className={`h-full rounded-full ${tokens.barBg}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{airQuality.statusNote}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
