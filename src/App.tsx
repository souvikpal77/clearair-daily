import { useEffect, useState } from 'react';
import { AirQualityHero } from './components/AirQualityHero.tsx';
import { AlternativesSection } from './components/AlternativesSection.tsx';
import { AssistantPanel } from './components/AssistantPanel.tsx';
import { CleanAirPriorities } from './components/CleanAirPriorities.tsx';
import { ContextSidebar } from './components/ContextSidebar.tsx';
import { DailyPlanSection } from './components/DailyPlanSection.tsx';
import { DirectImpactExplainer } from './components/DirectImpactExplainer.tsx';
import { IndoorAirSection } from './components/IndoorAirSection.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { TopBar, type NavSectionId } from './components/TopBar.tsx';
import { useAirQualityPlanner } from './hooks/useAirQualityPlanner.ts';
import { RESPONSIBLE_AI_DISCLAIMER } from './shared/constants.ts';

const SECTION_IDS: readonly NavSectionId[] = [
  'overview',
  'daily-plan',
  'indoor-air',
  'alternatives',
  'assistant',
];

export default function App() {
  const {
    profile,
    scenarioId,
    airQuality,
    planResponse,
    recommendations,
    isLoadingAq,
    aqError,
    isGeneratingPlan,
    planError,
    checkedActionIds,
    completedCount,
    updateProfile,
    selectScenario,
    updateCityQuick,
    retryPlanGeneration,
    toggleChecklistItem,
  } = useAirQualityPlanner();

  const [activeSection, setActiveSection] = useState<NavSectionId>('overview');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Keep active navigation synchronized with the visible viewport section
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const matchedSection = SECTION_IDS.find((id) => id === visible[0].target.id);
          if (matchedSection) {
            setActiveSection(matchedSection);
          }
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.1, 0.35, 0.6],
      }
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId: NavSectionId) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const jumpToChecklist = () => {
    setActiveSection('daily-plan');
    const el = document.getElementById('daily-checklist');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      <TopBar
        activeSection={activeSection}
        onSelectSection={scrollToSection}
        onOpenProfileModal={() => setIsProfileOpen(true)}
      />

      <main
        id="main-content"
        className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
      >
        {/* 1. Atmospheric Hero & Current Air Quality Decision Brief */}
        <AirQualityHero
          airQuality={airQuality}
          profile={profile}
          primaryImpact={planResponse.plan.impactExplanations[0]}
          isLoading={isLoadingAq}
          error={aqError}
          onRetry={retryPlanGeneration}
        />

        {/* 2. Deliberate Hierarchy: Priorities + Direct Impact + Planner + Household Rail */}
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <CleanAirPriorities
              recommendations={recommendations}
              onJumpToSection={(id) => scrollToSection(id)}
            />

            <DirectImpactExplainer chains={planResponse.plan.impactExplanations} />

            <DailyPlanSection
              planResponse={planResponse}
              isGenerating={isGeneratingPlan}
              error={planError}
              checkedActionIds={checkedActionIds}
              onToggleChecklistItem={toggleChecklistItem}
              onRetry={retryPlanGeneration}
            />

            <IndoorAirSection items={planResponse.plan.indoorActions} />

            <AlternativesSection
              alternatives={planResponse.plan.lowEmissionAlternatives}
              profile={profile}
            />

            <AssistantPanel
              profile={profile}
              airQuality={airQuality}
              planSummary={planResponse.plan.summary}
            />
          </div>

          <div className="min-w-0 lg:col-span-4">
            <ContextSidebar
              profile={profile}
              airQuality={airQuality}
              scenarioId={scenarioId}
              completedCount={completedCount}
              totalChecklistCount={planResponse.checklist.length}
              isLoadingAq={isLoadingAq}
              onUpdateCity={updateCityQuick}
              onSelectScenario={selectScenario}
              onOpenProfileModal={() => setIsProfileOpen(true)}
              onJumpToChecklist={jumpToChecklist}
            />
          </div>
        </div>
      </main>

      <footer className="mt-10 border-t border-[var(--border-subtle)] bg-white/90">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-800">Responsible AI & Data Notice:</strong>{' '}
            {RESPONSIBLE_AI_DISCLAIMER}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ClearAir Daily · Household profile and daily checklist stay in your browser; live
            air-quality readings are requested via Open-Meteo when available.
          </p>
        </div>
      </footer>

      <ProfileModal
        isOpen={isProfileOpen}
        initialProfile={profile}
        onClose={() => setIsProfileOpen(false)}
        onSave={updateProfile}
      />
    </div>
  );
}
