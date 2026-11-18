import { ArrowDown, ArrowRight, Info, Sparkles } from 'lucide-react';
import type { ImpactChain } from '../shared/types.ts';
import { SectionHeader } from './ui/Primitives.tsx';

interface DirectImpactExplainerProps {
  chains: readonly ImpactChain[];
}

const CATEGORY_META: Record<ImpactChain['category'], { label: string; accent: string }> = {
  mobility: { label: 'Mobility & Tailpipe', accent: 'text-sky-800 bg-sky-50 border-sky-200' },
  indoor: { label: 'Indoor Air Quality', accent: 'text-teal-800 bg-teal-50 border-teal-200' },
  exposure: { label: 'Exposure Timing', accent: 'text-amber-900 bg-amber-50 border-amber-200' },
  energy: { label: 'Home Energy', accent: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
};

export function DirectImpactExplainer({ chains }: DirectImpactExplainerProps) {
  return (
    <section
      aria-labelledby="impact-explainer-heading"
      className="surface-card rounded-2xl p-6"
    >
      <SectionHeader
        kicker="Cause & Effect Transparency"
        title="Direct Impact Explainer: How Your Choices Matter"
        titleId="impact-explainer-heading"
        description="See the exact physical mechanism connecting your daily decisions to lower emissions and reduced particle exposure. Numerical figures are labeled as estimates with stated assumptions."
      />

      <div className="mt-6 space-y-5">
        {chains.map((chain, index) => {
          const meta = CATEGORY_META[chain.category];
          return (
            <article
              key={chain.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-teal-300/80 hover:bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="font-mono-tabular font-bold text-teal-800">
                    0{index + 1}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 font-semibold ${meta.accent}`}>
                    {meta.label}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-xs font-semibold text-teal-900 font-mono-tabular">
                  <Sparkles className="h-3 w-3 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>{chain.estimatedRangeLabel}</span>
                </span>
              </div>

              <h3 className="mt-3 text-base font-bold text-slate-900">{chain.title}</h3>

              {/* 3-Stage Visual Flow: Action -> Mechanism -> Direct Impact */}
              <div className="mt-4 grid gap-2.5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    Action
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-slate-900">{chain.action}</p>
                </div>

                <div className="flex items-center justify-center py-0.5 md:py-0" aria-hidden="true">
                  <ArrowDown className="h-4 w-4 text-teal-700 md:hidden" />
                  <ArrowRight className="hidden h-4 w-4 text-teal-700 md:block" />
                </div>

                <div className="rounded-xl border border-sky-200/80 bg-sky-50/45 p-4">
                  <p className="text-[11px] font-bold tracking-wider text-sky-900 uppercase">
                    Mechanism
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-slate-900">{chain.mechanism}</p>
                </div>

                <div className="flex items-center justify-center py-0.5 md:py-0" aria-hidden="true">
                  <ArrowDown className="h-4 w-4 text-teal-700 md:hidden" />
                  <ArrowRight className="hidden h-4 w-4 text-teal-700 md:block" />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <p className="text-[11px] font-bold tracking-wider text-emerald-900 uppercase">
                    Direct Impact
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">
                    {chain.directImpact}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-slate-200/70 bg-white/80 px-3.5 py-2.5 text-xs text-slate-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="space-y-1 leading-relaxed">
                  <p>
                    <strong className="font-semibold text-slate-800">Estimated · Assumptions:</strong>{' '}
                    {chain.assumptions}
                  </p>
                  {chain.limitations && (
                    <p className="text-slate-500">
                      <strong className="font-semibold text-slate-700">Limitations:</strong>{' '}
                      {chain.limitations}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
