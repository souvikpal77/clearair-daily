import {
  Activity,
  Car,
  CheckCircle2,
  Home,
  Shield,
  Zap,
} from 'lucide-react';
import type {
  RecommendationDomain,
  RecommendationPriority,
  StructuredRecommendation,
} from '../shared/types.ts';
import { SectionHeader } from './ui/Primitives.tsx';

interface CleanAirPrioritiesProps {
  recommendations: readonly StructuredRecommendation[];
  onJumpToSection: (sectionId: 'daily-plan' | 'indoor-air' | 'alternatives') => void;
}

const DOMAIN_META: Record<
  RecommendationDomain,
  { label: string; icon: typeof Car; toneClass: string }
> = {
  exposure: {
    label: 'Outdoor Activity',
    icon: Activity,
    toneClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
  },
  transport: {
    label: 'Commute & Mobility',
    icon: Car,
    toneClass: 'bg-sky-50 text-sky-800 border-sky-200/80',
  },
  indoor: {
    label: 'Indoor Air',
    icon: Home,
    toneClass: 'bg-teal-50 text-teal-800 border-teal-200/80',
  },
  protection: {
    label: 'Family Protection',
    icon: Shield,
    toneClass: 'bg-orange-50 text-orange-900 border-orange-200/80',
  },
  energy: {
    label: 'Home Energy',
    icon: Zap,
    toneClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  },
};

const PRIORITY_BADGE_STYLE: Record<
  RecommendationPriority,
  { label: string; classes: string }
> = {
  critical: {
    label: 'Critical',
    classes: 'border-rose-200 bg-rose-50 text-rose-900',
  },
  high: {
    label: 'High Priority',
    classes: 'border-orange-200 bg-orange-50 text-orange-900',
  },
  medium: {
    label: 'Medium',
    classes: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  low: {
    label: 'Routine',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
};

export function CleanAirPriorities({
  recommendations,
  onJumpToSection,
}: CleanAirPrioritiesProps) {
  return (
    <section
      aria-labelledby="priorities-heading"
      className="surface-card rounded-2xl p-6"
    >
      <SectionHeader
        kicker="What Should I Do Today?"
        title="Your Clean-Air Priorities"
        titleId="priorities-heading"
        description="High-leverage steps ordered deterministically for today's air quality and your household setup."
      />

      <div
        className={`mt-5 grid gap-4 ${
          recommendations.length >= 4 || recommendations.length === 2
            ? 'sm:grid-cols-2'
            : 'md:grid-cols-3'
        }`}
      >
        {recommendations.map((rec) => {
          const meta = DOMAIN_META[rec.category];
          const priorityBadge = PRIORITY_BADGE_STYLE[rec.priority];
          const Icon = meta.icon;

          return (
            <article
              key={rec.id}
              className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${meta.toneClass}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {meta.label}
                    </span>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${priorityBadge.classes}`}
                  >
                    {priorityBadge.label}
                  </span>
                </div>

                <h3 className="mt-3.5 text-base font-bold text-slate-900">{rec.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{rec.action}</p>
              </div>

              <div className="mt-4 border-t border-slate-200/70 pt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{rec.impact}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onJumpToSection(rec.targetSection)}
                  className="text-xs font-semibold text-slate-700 underline-offset-4 hover:text-teal-800 hover:underline whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded"
                >
                  Details
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
