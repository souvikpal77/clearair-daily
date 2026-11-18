import { useState, type FormEvent } from 'react';
import {
  Car,
  CheckCircle2,
  Flame,
  Info,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  Users,
  Wind,
} from 'lucide-react';
import { formatDataFreshness } from '../core/formatters.ts';
import { PLANNING_SCENARIOS } from '../shared/constants.ts';
import { PlanningScenarioIdSchema } from '../shared/schemas.ts';
import type {
  AirQualityContext,
  PlanningScenarioId,
  UserProfile,
} from '../shared/types.ts';

interface ContextSidebarProps {
  profile: UserProfile;
  airQuality: AirQualityContext;
  scenarioId: PlanningScenarioId;
  completedCount: number;
  totalChecklistCount: number;
  isLoadingAq: boolean;
  onUpdateCity: (city: string) => void;
  onSelectScenario: (scenarioId: PlanningScenarioId) => void;
  onOpenProfileModal: () => void;
  onJumpToChecklist: () => void;
}

const COMMUTE_LABELS: Record<UserProfile['commuteMode'], string> = {
  car_solo: 'Solo car',
  carpool: 'Carpool',
  public_transit: 'Transit',
  walk_cycle: 'Walk / cycle',
  remote_work: 'Remote',
};

const COOKING_LABELS: Record<UserProfile['cookingFuel'], string> = {
  gas_stove: 'Gas stove',
  induction_electric: 'Electric / induction',
  solid_fuel_wood: 'Solid fuel',
};

const SENSITIVITY_LABELS: Record<UserProfile['sensitivityGroup'], string> = {
  general: 'General adult',
  children_elderly: 'Kids / older adults',
  respiratory_sensitive: 'Respiratory sensitive',
};

export function ContextSidebar({
  profile,
  airQuality,
  scenarioId,
  completedCount,
  totalChecklistCount,
  isLoadingAq,
  onUpdateCity,
  onSelectScenario,
  onOpenProfileModal,
  onJumpToChecklist,
}: ContextSidebarProps) {
  const [cityInput, setCityInput] = useState(profile.city);
  const [syncedCity, setSyncedCity] = useState(profile.city);
  const [cityError, setCityError] = useState<string | null>(null);

  if (profile.city !== syncedCity) {
    setSyncedCity(profile.city);
    setCityInput(profile.city);
  }

  const handleCitySubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = cityInput.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setCityError('Enter a city name between 2 and 80 characters.');
      return;
    }
    setCityError(null);
    onUpdateCity(trimmed);
  };

  const progressPct =
    totalChecklistCount > 0 ? Math.round((completedCount / totalChecklistCount) * 100) : 0;

  const freshness = formatDataFreshness(airQuality.observedAt, airQuality.dataSource);

  return (
    <aside
      aria-label="Household profile and air intelligence"
      className="w-full space-y-5 lg:sticky lg:top-20"
    >
      {/* Compact Scannable Household Profile Card */}
      <section className="surface-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-teal-800 uppercase">
              Your Setup
            </p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">Household Profile</h2>
          </div>
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit</span>
          </button>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] p-3">
            <div className="flex items-center gap-1.5 text-teal-700">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium text-slate-500">Household</span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-slate-900 font-mono-tabular">
              {profile.householdSize} {profile.householdSize === 1 ? 'person' : 'people'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] p-3">
            <div className="flex items-center gap-1.5 text-sky-700">
              <Car className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium text-slate-500">Commute</span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-slate-900 truncate">
              {COMMUTE_LABELS[profile.commuteMode]} ·{' '}
              <span className="font-mono-tabular">{profile.commuteDistanceKm} km</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] p-3">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium text-slate-500">Cooking</span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-slate-900 truncate">
              {COOKING_LABELS[profile.cookingFuel]}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] p-3">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <Wind className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-medium text-slate-500">Filtration</span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-slate-900">
              {profile.hasHepaFilter ? 'HEPA purifier' : 'No HEPA unit'}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Sensitivity:{' '}
          <strong className="font-semibold text-slate-700">
            {SENSITIVITY_LABELS[profile.sensitivityGroup]}
          </strong>
        </p>
      </section>

      {/* Air Intelligence / Data Source Card */}
      <section className="surface-card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-sky-800 uppercase">
              Air Intelligence
            </p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">
              Location & Data Source
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
              freshness.isLive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {freshness.isLive ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span>{freshness.isLive ? 'Live Data' : 'Estimated'}</span>
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Location</span>
            <span className="font-semibold text-slate-900">{airQuality.cityResolved}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Freshness</span>
            <span className="font-medium text-slate-800">{freshness.label}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Source</span>
            <span className="font-medium text-slate-700 text-right truncate max-w-[160px]">
              {airQuality.provider}
            </span>
          </div>
        </div>

        <form onSubmit={handleCitySubmit} className="mt-3.5 space-y-2.5" noValidate>
          <div>
            <label
              htmlFor="sidebar-city-input"
              className="block text-xs font-medium text-slate-700"
            >
              City or urban area
            </label>
            <div className="mt-1 flex gap-2">
              <div className="relative flex-1">
                <MapPin
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="sidebar-city-input"
                  type="text"
                  value={cityInput}
                  onChange={(e) => {
                    setCityInput(e.target.value);
                    if (cityError) setCityError(null);
                  }}
                  aria-invalid={Boolean(cityError)}
                  aria-describedby={cityError ? 'sidebar-city-error' : undefined}
                  placeholder="e.g., Delhi, Warsaw, Seoul"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
                />
              </div>
              <button
                type="submit"
                disabled={isLoadingAq}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                aria-label="Check city air quality"
              >
                {isLoadingAq ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  'Check'
                )}
              </button>
            </div>
            {cityError && (
              <p id="sidebar-city-error" role="alert" className="mt-1.5 text-xs text-red-700">
                {cityError}
              </p>
            )}
          </div>
        </form>

        <div className="mt-3.5 border-t border-slate-100 pt-3">
          <label
            htmlFor="scenario-select"
            className="block text-xs font-medium text-slate-700"
          >
            Air quality source / drill scenario
          </label>
          <select
            id="scenario-select"
            value={scenarioId}
            onChange={(e) => {
              const parsed = PlanningScenarioIdSchema.safeParse(e.target.value);
              if (parsed.success) {
                onSelectScenario(parsed.data);
              }
            }}
            className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
          >
            {PLANNING_SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            {PLANNING_SCENARIOS.find((s) => s.id === scenarioId)?.summary}
          </p>
        </div>
      </section>

      {/* Today's Action Progress Card */}
      <section className="surface-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">Today’s Clean-Air Progress</h2>
          <span className="text-xs font-semibold text-teal-800 font-mono-tabular">
            {completedCount}/{totalChecklistCount}
          </span>
        </div>
        <div
          className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Daily air quality actions completed"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-700 to-emerald-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Habits completed today are saved locally in your browser.
        </p>
        <button
          type="button"
          onClick={onJumpToChecklist}
          className="mt-3 min-h-[40px] w-full rounded-lg border border-slate-200 bg-[var(--surface-elevated)] px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
        >
          Open Action Checklist
        </button>
      </section>
    </aside>
  );
}
