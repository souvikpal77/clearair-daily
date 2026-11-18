import {
  CalendarClock,
  Compass,
  Home,
  Leaf,
  MessageCircle,
  SlidersHorizontal,
} from 'lucide-react';

export type NavSectionId =
  | 'overview'
  | 'daily-plan'
  | 'indoor-air'
  | 'alternatives'
  | 'assistant';

interface TopBarProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  onOpenProfileModal: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: NavSectionId;
  label: string;
  icon: typeof Compass;
}> = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'daily-plan', label: 'Daily Plan', icon: CalendarClock },
  { id: 'indoor-air', label: 'Indoor Air', icon: Home },
  { id: 'alternatives', label: 'Alternatives', icon: Leaf },
  { id: 'assistant', label: 'Assistant', icon: MessageCircle },
];

export function TopBar({
  activeSection,
  onSelectSection,
  onOpenProfileModal,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-white/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Zone 1: Distinctive Environmental Brand Mark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('overview');
          }}
          className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-sky-700 text-white shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8h11a3 3 0 1 0-3-3" />
              <path d="M3 12h15a3 3 0 1 1-3 3" />
              <path d="M3 16h7a2.5 2.5 0 1 1-2.5 2.5" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            ClearAir Daily
          </span>
        </a>

        {/* Zone 2: Single-line Primary Navigation */}
        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-1.5"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18)]'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Update Profile</span>
          </button>
        </div>
      </div>

      {/* Compact Mobile Navigation */}
      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                isActive
                  ? 'bg-teal-50 text-teal-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
