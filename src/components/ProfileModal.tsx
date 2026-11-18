import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  CommuteModeSchema,
  CookingFuelSchema,
  OutdoorHabitSchema,
  SensitivityGroupSchema,
  UserProfileSchema,
  VentilationTypeSchema,
  WorkScheduleSchema,
} from '../shared/schemas.ts';
import type { UserProfile } from '../shared/types.ts';

interface ProfileModalProps {
  isOpen: boolean;
  initialProfile: UserProfile;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

export function ProfileModal({
  isOpen,
  initialProfile,
  onClose,
  onSave,
}: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <ProfileModalDialog
      initialProfile={initialProfile}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

interface ProfileModalDialogProps {
  initialProfile: UserProfile;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

function ProfileModalDialog({
  initialProfile,
  onClose,
  onSave,
}: ProfileModalDialogProps) {
  const [draft, setDraft] = useState<UserProfile>(initialProfile);
  const [formError, setFormError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus(), 20);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = UserProfileSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(
        'Please check that your city name is 2–80 characters, household size is 1–15, and commute distance is 0–150 km.'
      );
      return;
    }
    setFormError(null);
    onSave(parsed.data);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="profile-modal-title" className="text-lg font-bold text-slate-900">
              Personalize Your Household Air Profile
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Only essential routine details are used to tailor your daily plan. No account,
              address, or health record is collected.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile dialog"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          {formError && (
            <div
              id="profile-form-error"
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
            >
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-city" className="block text-xs font-semibold text-slate-700">
                City or urban region
              </label>
              <input
                ref={firstInputRef}
                id="profile-city"
                type="text"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                aria-invalid={Boolean(formError && draft.city.trim().length < 2)}
                aria-describedby={formError ? 'profile-form-error' : undefined}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="profile-household-size"
                className="block text-xs font-semibold text-slate-700"
              >
                Household size (people)
              </label>
              <input
                id="profile-household-size"
                type="number"
                min={1}
                max={15}
                value={draft.householdSize}
                onChange={(e) =>
                  setDraft({ ...draft, householdSize: Math.max(1, Number(e.target.value) || 1) })
                }
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="profile-commute-mode"
                className="block text-xs font-semibold text-slate-700"
              >
                Typical commute
              </label>
              <select
                id="profile-commute-mode"
                value={draft.commuteMode}
                onChange={(e) => {
                  const parsed = CommuteModeSchema.safeParse(e.target.value);
                  if (parsed.success) {
                    setDraft({ ...draft, commuteMode: parsed.data });
                  }
                }}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              >
                <option value="car_solo">Solo car</option>
                <option value="carpool">Shared carpool</option>
                <option value="public_transit">Public transit (bus / metro / rail)</option>
                <option value="walk_cycle">Walk or cycle</option>
                <option value="remote_work">Remote / no regular commute</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-commute-distance"
                className="block text-xs font-semibold text-slate-700"
              >
                One-way commute distance (km)
              </label>
              <input
                id="profile-commute-distance"
                type="number"
                min={0}
                max={150}
                step={0.5}
                value={draft.commuteDistanceKm}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    commuteDistanceKm: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              />
            </div>

            <div>
              <label
                htmlFor="profile-work-schedule"
                className="block text-xs font-semibold text-slate-700"
              >
                Work or study schedule
              </label>
              <select
                id="profile-work-schedule"
                value={draft.workSchedule}
                onChange={(e) => {
                  const parsed = WorkScheduleSchema.safeParse(e.target.value);
                  if (parsed.success) {
                    setDraft({ ...draft, workSchedule: parsed.data });
                  }
                }}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              >
                <option value="standard_9_to_5">Standard daytime (09:00–17:30)</option>
                <option value="early_shift">Early morning shift</option>
                <option value="flexible_hybrid">Flexible / hybrid remote</option>
                <option value="home_based">Mostly home-based</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-outdoor-habit"
                className="block text-xs font-semibold text-slate-700"
              >
                Outdoor activity habit
              </label>
              <select
                id="profile-outdoor-habit"
                value={draft.outdoorHabit}
                onChange={(e) => {
                  const parsed = OutdoorHabitSchema.safeParse(e.target.value);
                  if (parsed.success) {
                    setDraft({ ...draft, outdoorHabit: parsed.data });
                  }
                }}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              >
                <option value="daily_exercise">Daily outdoor exercise / run</option>
                <option value="short_walks">Short daily walks / errands</option>
                <option value="mostly_indoors">Mostly indoors in winter</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-cooking-fuel"
                className="block text-xs font-semibold text-slate-700"
              >
                Primary cooking setup
              </label>
              <select
                id="profile-cooking-fuel"
                value={draft.cookingFuel}
                onChange={(e) => {
                  const parsed = CookingFuelSchema.safeParse(e.target.value);
                  if (parsed.success) {
                    setDraft({ ...draft, cookingFuel: parsed.data });
                  }
                }}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              >
                <option value="gas_stove">Gas stove / range</option>
                <option value="induction_electric">Induction or electric</option>
                <option value="solid_fuel_wood">Solid fuel / wood / biomass</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-ventilation"
                className="block text-xs font-semibold text-slate-700"
              >
                Home ventilation
              </label>
              <select
                id="profile-ventilation"
                value={draft.ventilationType}
                onChange={(e) => {
                  const parsed = VentilationTypeSchema.safeParse(e.target.value);
                  if (parsed.success) {
                    setDraft({ ...draft, ventilationType: parsed.data });
                  }
                }}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              >
                <option value="exhaust_hood">Kitchen/bath exhaust fan + windows</option>
                <option value="windows_only">Windows only (natural ventilation)</option>
                <option value="mechanical_hvac">Central HVAC with duct filtration</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-sensitivity"
                className="block text-xs font-semibold text-slate-700"
              >
                Household sensitivity profile
              </label>
              <select
                id="profile-sensitivity"
                value={draft.sensitivityGroup}
                onChange={(e) => {
                  const parsed = SensitivityGroupSchema.safeParse(e.target.value);
                  if (parsed.success) {
                    setDraft({ ...draft, sensitivityGroup: parsed.data });
                  }
                }}
                className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
              >
                <option value="general">General adult household</option>
                <option value="children_elderly">Includes children or older adults</option>
                <option value="respiratory_sensitive">Respiratory or heart sensitivity</option>
              </select>
            </div>

            <div className="flex items-end pb-1">
              <label
                htmlFor="profile-hepa-checkbox"
                className="flex min-h-[40px] w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
              >
                <input
                  id="profile-hepa-checkbox"
                  type="checkbox"
                  checked={draft.hasHepaFilter}
                  onChange={(e) => setDraft({ ...draft, hasHepaFilter: e.target.checked })}
                  className="h-4 w-4 accent-teal-700"
                />
                <span>Access to a HEPA air purifier</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              Save & Refresh Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
