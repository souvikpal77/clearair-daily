import {
  BedDouble,
  Flame,
  ShieldCheck,
  Sofa,
  UtensilsCrossed,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { IndoorGuidanceItem } from '../shared/types.ts';
import { SectionHeader } from './ui/Primitives.tsx';

interface IndoorAirSectionProps {
  items: readonly IndoorGuidanceItem[];
}

const ROOM_CONTEXT_META: Record<
  IndoorGuidanceItem['area'],
  { roomLabel: string; icon: LucideIcon; accent: string }
> = {
  Cooking: {
    roomLabel: 'Kitchen',
    icon: UtensilsCrossed,
    accent: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  Ventilation: {
    roomLabel: 'Living Room & Windows',
    icon: Sofa,
    accent: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  Filtration: {
    roomLabel: 'Bedroom Clean Zone',
    icon: BedDouble,
    accent: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  Combustion: {
    roomLabel: 'Whole Home',
    icon: Flame,
    accent: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  'Living Space': {
    roomLabel: 'Workspace & Study',
    icon: Wind,
    accent: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

export function IndoorAirSection({ items }: IndoorAirSectionProps) {
  const evidenceItems = items.filter((item) => item.sourceType === 'evidence_based');
  const personalizedItems = items.filter((item) => item.sourceType === 'ai_personalized');

  const renderRoomCard = (item: IndoorGuidanceItem, isTailored: boolean) => {
    const room = ROOM_CONTEXT_META[item.area];
    const RoomIcon = room.icon;

    return (
      <article
        key={item.id}
        className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
          isTailored
            ? 'border-teal-200 bg-teal-50/35 hover:bg-teal-50/55'
            : 'border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:bg-white'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${room.accent}`}
              >
                <RoomIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">{room.roomLabel}</p>
                <p className="text-[11px] text-slate-500">{item.area}</p>
              </div>
            </div>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                isTailored
                  ? 'border-teal-200 bg-white text-teal-900'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {isTailored ? 'Tailored Setup' : 'Evidence-Based'}
            </span>
          </div>

          <h4 className="mt-3.5 text-sm font-bold text-slate-900">{item.title}</h4>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{item.guidance}</p>
        </div>

        <p className="mt-3.5 border-t border-slate-200/70 pt-2.5 text-xs leading-relaxed text-slate-600">
          <strong className="font-semibold text-slate-800">
            {isTailored ? 'Context basis:' : 'Why it works:'}
          </strong>{' '}
          {item.rationale}
        </p>
      </article>
    );
  };

  return (
    <section
      id="indoor-air"
      aria-labelledby="indoor-air-heading"
      className="scroll-mt-20 surface-card rounded-2xl p-6"
    >
      <SectionHeader
        kicker="Room-by-Room Guidance"
        title="Indoor Air Quality Assistant"
        titleId="indoor-air-heading"
        description="Actionable steps organized by room and pollution source. Established environmental-health principles are separated clearly from household-tailored guidance."
      />

      <div className="mt-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Evidence-Based Indoor Air Guidance
          </h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {evidenceItems.map((item) => renderRoomCard(item, false))}
          </div>
        </div>

        {personalizedItems.length > 0 && (
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-bold text-slate-900">
              Tailored to Your Home Setup
            </h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {personalizedItems.map((item) => renderRoomCard(item, true))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
        <p className="leading-relaxed">
          Indoor guidance reduces indoor pollutant sources and particle infiltration. It is not a
          medical treatment or substitute for professional clinical advice for asthma, COPD, or
          cardiovascular conditions.
        </p>
      </div>
    </section>
  );
}
