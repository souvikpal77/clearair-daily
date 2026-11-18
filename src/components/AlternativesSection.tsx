import { useMemo, useState } from 'react';
import { ArrowRight, Leaf, Scale, Users } from 'lucide-react';
import { calculateCommunityProjection } from '../core/impactCalculator.ts';
import type { AlternativeComparison, UserProfile } from '../shared/types.ts';
import { SectionHeader } from './ui/Primitives.tsx';

interface AlternativesSectionProps {
  alternatives: readonly AlternativeComparison[];
  profile: UserProfile;
}

const PRACTICALITY_BARS: Record<
  AlternativeComparison['practicality'],
  { segments: number; color: string }
> = {
  High: { segments: 3, color: 'bg-emerald-600' },
  Moderate: { segments: 2, color: 'bg-amber-500' },
  Situational: { segments: 1, color: 'bg-sky-600' },
};

export function AlternativesSection({ alternatives, profile }: AlternativesSectionProps) {
  const [householdsCount, setHouseholdsCount] = useState<number>(250);

  const projection = useMemo(
    () => calculateCommunityProjection(profile, householdsCount, 2),
    [profile, householdsCount]
  );

  return (
    <section
      id="alternatives"
      aria-labelledby="alternatives-heading"
      className="scroll-mt-20 space-y-6"
    >
      <div className="surface-card rounded-2xl p-6">
        <SectionHeader
          kicker="Realistic Choice Comparison"
          title="Sustainable & Low-Emission Alternatives"
          titleId="alternatives-heading"
          description="Compare your current routine against lower-emission alternatives with practicality context, real-world trade-offs, and situations where an option may not fit."
        />

        <div className="mt-6 space-y-4">
          {alternatives.map((alt) => {
            const prac = PRACTICALITY_BARS[alt.practicality];
            return (
              <article
                key={alt.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-teal-300/80 hover:bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Scale className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    <span>{alt.domain}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Practicality:</span>
                    <span className="font-semibold text-slate-900">{alt.practicality}</span>
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {[1, 2, 3].map((idx) => (
                        <span
                          key={idx}
                          className={`h-1.5 w-3.5 rounded-full ${
                            idx <= prac.segments ? prac.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </span>
                  </div>
                </div>

                {/* Comparison Visual Row */}
                <div className="mt-3.5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      Current Choice
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-slate-900">
                      {alt.currentChoice}
                    </p>
                  </div>

                  <div className="flex items-center justify-center py-0.5 md:py-0" aria-hidden="true">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700">
                      <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" />
                    </span>
                  </div>

                  <div className="rounded-xl border border-teal-200 bg-teal-50/55 p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-teal-900 uppercase">
                      <Leaf className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                      <span>Lower-Emission Alternative</span>
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">
                      {alt.alternativeChoice}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3.5 border-t border-slate-200/70 pt-4 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-slate-800">Environmental reasoning</dt>
                    <dd className="mt-1 leading-relaxed text-slate-600">
                      {alt.environmentalReasoning}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-800">
                      Estimated impact & assumptions
                    </dt>
                    <dd className="mt-1 font-semibold text-teal-900">{alt.estimatedImpact}</dd>
                    <dd className="mt-0.5 text-slate-500">{alt.assumptions}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-800">Practical trade-offs</dt>
                    <dd className="mt-1 leading-relaxed text-slate-600">{alt.tradeOffs}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-800">When not suitable</dt>
                    <dd className="mt-1 leading-relaxed text-slate-600">{alt.whenNotSuitable}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </div>

      {/* Community / Family Collective Perspective */}
      <div className="surface-card rounded-2xl p-6">
        <SectionHeader
          kicker="Collective Perspective"
          title="How Household Routines Scale Across a Neighborhood"
          titleId="collective-perspective-heading"
          description="Individual choices reduce personal activity emissions directly. Explore how consistent weekly shifts scale proportionally when adopted across households."
          action={<Users className="h-5 w-5 text-teal-700" aria-hidden="true" />}
        />

        <div className="mt-5 grid gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] p-4">
            <label
              htmlFor="community-households-slider"
              className="flex items-center justify-between text-sm font-semibold text-slate-800"
            >
              <span>Participating households</span>
              <span className="font-mono-tabular text-teal-800">
                {householdsCount.toLocaleString()} households
              </span>
            </label>
            <input
              id="community-households-slider"
              type="range"
              min={10}
              max={1000}
              step={10}
              value={householdsCount}
              onChange={(e) => setHouseholdsCount(Number(e.target.value))}
              aria-valuetext={`${householdsCount} participating households`}
              className="mt-3 w-full accent-teal-700 cursor-pointer"
            />
            <div className="mt-1.5 flex justify-between text-xs text-slate-500 font-mono-tabular">
              <span>10</span>
              <span>250</span>
              <span>500</span>
              <span>1,000</span>
            </div>
          </div>

          <div className="lg:col-span-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">
                1 household (2 trips/week shifted)
              </p>
              <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono-tabular">
                {projection.individualEstimatedKmReduced} km/wk avoided
              </p>
              <p className="mt-1 text-xs text-slate-600 font-mono-tabular">
                Est. {projection.individualEstimatedCo2KgRange[0]}–
                {projection.individualEstimatedCo2KgRange[1]} kg CO2e/wk
              </p>
            </div>

            <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/80 to-emerald-50/60 p-4">
              <p className="text-xs font-semibold text-teal-900">
                {projection.participatingHouseholds.toLocaleString()} households combined
              </p>
              <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono-tabular">
                {projection.collectiveEstimatedKmReduced.toLocaleString()} km/wk avoided
              </p>
              <p className="mt-1 text-xs font-medium text-teal-900 font-mono-tabular">
                Est. {projection.collectiveEstimatedCo2KgRange[0].toLocaleString()}–
                {projection.collectiveEstimatedCo2KgRange[1].toLocaleString()} kg CO2e/wk
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3.5 text-xs leading-relaxed text-slate-500">
          <strong className="font-semibold text-slate-700">Methodology & limits:</strong>{' '}
          {projection.methodologyNote}
        </p>
      </div>
    </section>
  );
}
