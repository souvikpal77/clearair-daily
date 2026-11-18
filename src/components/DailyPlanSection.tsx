import {
  AlertCircle,
  Check,
  Clock,
  Moon,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
} from 'lucide-react';
import type {
  ActionChecklistItem,
  GeneratedAirPlanResponse,
  PlanTimeSlot,
} from '../shared/types.ts';
import { SectionHeader } from './ui/Primitives.tsx';

interface DailyPlanSectionProps {
  planResponse: GeneratedAirPlanResponse;
  isGenerating: boolean;
  error: string | null;
  checkedActionIds: readonly string[];
  onToggleChecklistItem: (id: string) => void;
  onRetry: () => void;
}

const PRIORITY_STYLE: Record<
  PlanTimeSlot['priority'],
  { label: string; badge: string; node: string }
> = {
  high: {
    label: 'High Priority',
    badge: 'bg-orange-50 text-orange-900 border-orange-200',
    node: 'bg-orange-500 text-white',
  },
  moderate: {
    label: 'Recommended',
    badge: 'bg-teal-50 text-teal-900 border-teal-200',
    node: 'bg-teal-700 text-white',
  },
  low: {
    label: 'Routine',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    node: 'bg-slate-500 text-white',
  },
};

function getTimeSlotIcon(index: number) {
  if (index === 0) return Sunrise;
  if (index === 1 || index === 2) return Sun;
  if (index === 3 || index === 4) return Sunset;
  return Moon;
}

export function DailyPlanSection({
  planResponse,
  isGenerating,
  error,
  checkedActionIds,
  onToggleChecklistItem,
  onRetry,
}: DailyPlanSectionProps) {
  const { plan, checklist, generationMode, fallbackNotice } = planResponse;

  return (
    <section
      id="daily-plan"
      aria-labelledby="daily-plan-heading"
      className="scroll-mt-20 surface-card rounded-2xl p-6"
    >
      <SectionHeader
        kicker={
          generationMode === 'gemini_personalized'
            ? `AI-Personalized Schedule · Updated ${new Date(planResponse.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : `Verified Schedule · Updated ${new Date(planResponse.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        }
        title="Personalized Daily Air Plan"
        titleId="daily-plan-heading"
        description={plan.summary}
        action={
          <button
            type="button"
            onClick={onRetry}
            disabled={isGenerating}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-[var(--surface-elevated)] px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isGenerating ? 'Personalizing…' : 'Regenerate Plan'}</span>
          </button>
        }
      />

      {(fallbackNotice || error) && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span>{error ?? fallbackNotice}</span>
        </div>
      )}

      {/* Key Focus & Cautions */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 border-b border-slate-100 pb-6">
        <div className="rounded-xl border border-teal-200/70 bg-teal-50/40 p-4">
          <h3 className="text-sm font-bold text-slate-900">Key Daily Focus</h3>
          <ul className="mt-2.5 space-y-2 text-sm text-slate-700">
            {plan.priorities.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[11px] font-bold text-white font-mono-tabular">
                  {idx + 1}
                </span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/45 p-4">
          <h3 className="text-sm font-bold text-slate-900">Safety Cautions & Limits</h3>
          <ul className="mt-2.5 space-y-2 text-sm text-slate-700">
            {plan.cautions.map((caution, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span
                  className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-600 shrink-0"
                  aria-hidden="true"
                />
                <span className="leading-snug">{caution}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Connected Chronological Timeline */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-slate-900">Day-by-Window Timeline</h3>
        <ol className="relative mt-4 space-y-4 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-slate-200">
          {plan.dailyPlan.map((slot, index) => {
            const style = PRIORITY_STYLE[slot.priority];
            const SlotIcon = getTimeSlotIcon(index);
            return (
              <li key={slot.id} className="relative pl-14">
                <span
                  aria-hidden="true"
                  className={`absolute left-1.5 top-4 flex h-7 w-7 items-center justify-center rounded-full shadow-xs ring-4 ring-white ${style.node}`}
                >
                  <SlotIcon className="h-3.5 w-3.5" />
                </span>

                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 transition-colors hover:border-teal-300/70 hover:bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 font-mono-tabular">
                      <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <span>{slot.windowLabel}</span>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  <h4 className="mt-1.5 text-sm font-bold text-slate-900">{slot.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{slot.guidance}</p>

                  {slot.avoidOrReduce && (
                    <p className="mt-2.5 rounded-lg border border-orange-200/70 bg-orange-50/60 px-3 py-2 text-xs text-orange-950">
                      <strong className="font-semibold">Avoid or reduce:</strong>{' '}
                      {slot.avoidOrReduce}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Daily Action Checklist */}
      <div id="daily-checklist" className="mt-7 border-t border-slate-100 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Daily Action Tracking</h3>
            <p className="text-xs text-slate-500">
              Check off protective and low-emission habits completed today.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 font-mono-tabular">
            {checkedActionIds.length} of {checklist.length} completed
          </span>
        </div>

        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {checklist.map((item: ActionChecklistItem) => {
            const isChecked = checkedActionIds.includes(item.id);
            const checkboxId = `action-check-${item.id}`;
            return (
              <li key={item.id}>
                <label
                  htmlFor={checkboxId}
                  className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    isChecked
                      ? 'border-teal-300 bg-teal-50/55'
                      : 'border-slate-200 bg-white hover:border-teal-300/70 hover:bg-slate-50/70'
                  }`}
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleChecklistItem(item.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isChecked
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1">
                    <span
                      className={`block text-sm leading-snug ${
                        isChecked ? 'text-slate-600 line-through' : 'font-medium text-slate-900'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {item.timeWindow} · {item.category}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
