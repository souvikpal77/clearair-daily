import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildEstimatedScenarioContext } from '../core/aqCategorizer.ts';
import { buildActionChecklist, buildDeterministicPlan } from '../core/dailyPlanGenerator.ts';
import { buildDeterministicRecommendations } from '../core/recommendationEngine.ts';
import {
  fetchAirQuality,
  requestPersonalizedPlan,
} from '../services/apiClient.ts';
import {
  DEFAULT_USER_PROFILE,
  RESPONSIBLE_AI_DISCLAIMER,
} from '../shared/constants.ts';
import {
  ChecklistStorageSchema,
  SafeShortTextSchema,
  UserProfileSchema,
} from '../shared/schemas.ts';
import type {
  AirQualityContext,
  GeneratedAirPlanResponse,
  PlanningScenarioId,
  StructuredRecommendation,
  UserProfile,
} from '../shared/types.ts';

const PROFILE_STORAGE_KEY = 'clearair_daily_profile_v1';
const CHECKLIST_STORAGE_KEY = 'clearair_daily_checklist_v1';

function loadStoredProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return DEFAULT_USER_PROFILE;
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = UserProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_USER_PROFILE;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStoredCheckedIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = ChecklistStorageSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.date !== getTodayDateKey()) {
      return [];
    }
    return parsed.data.ids;
  } catch {
    return [];
  }
}

function writeStorageJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors gracefully
  }
}

export function useAirQualityPlanner() {
  const [initialBootstrap] = useState(() => {
    const initialProfile = loadStoredProfile();
    const initialAq = buildEstimatedScenarioContext(
      initialProfile.city,
      'moderate_winter_haze',
      'Loading live conditions… Showing an estimated baseline until telemetry resolves.'
    );
    const initialPlan: GeneratedAirPlanResponse = {
      plan: buildDeterministicPlan(initialProfile, initialAq),
      recommendations: buildDeterministicRecommendations(initialProfile, initialAq),
      checklist: buildActionChecklist(initialProfile, initialAq),
      generationMode: 'deterministic_fallback',
      fallbackNotice: null,
      generatedAt: new Date().toISOString(),
      disclaimer: RESPONSIBLE_AI_DISCLAIMER,
    };
    return { initialProfile, initialAq, initialPlan };
  });

  const [profile, setProfile] = useState<UserProfile>(initialBootstrap.initialProfile);
  const [scenarioId, setScenarioId] = useState<PlanningScenarioId>('live');
  const [airQuality, setAirQuality] = useState<AirQualityContext>(initialBootstrap.initialAq);
  const [planResponse, setPlanResponse] = useState<GeneratedAirPlanResponse>(
    initialBootstrap.initialPlan
  );

  const [isLoadingAq, setIsLoadingAq] = useState<boolean>(true);
  const [aqError, setAqError] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [checkedActionIds, setCheckedActionIds] = useState<string[]>(loadStoredCheckedIds);

  const activeRequestRef = useRef<AbortController | null>(null);

  const generatePlanForContext = useCallback(
    async (
      nextProfile: UserProfile,
      resolvedAq: AirQualityContext,
      signal: AbortSignal
    ) => {
      const deterministicRecs = buildDeterministicRecommendations(nextProfile, resolvedAq);
      setPlanResponse((prev) => ({
        ...prev,
        plan: buildDeterministicPlan(nextProfile, resolvedAq),
        recommendations: deterministicRecs,
        checklist: buildActionChecklist(nextProfile, resolvedAq),
      }));

      setPlanError(null);
      setIsGeneratingPlan(true);
      try {
        const generated = await requestPersonalizedPlan(nextProfile, resolvedAq, signal);
        if (signal.aborted) return;
        setPlanResponse({
          ...generated,
          recommendations: generated.recommendations ?? deterministicRecs,
        });
      } catch (err) {
        if (signal.aborted) return;
        setPlanError(
          err instanceof Error
            ? `${err.message} Showing deterministic guidance instead.`
            : 'Personalization service unavailable. Showing deterministic guidance.'
        );
      } finally {
        if (!signal.aborted) {
          setIsGeneratingPlan(false);
        }
      }
    },
    []
  );

  const runRefreshPipeline = useCallback(
    async (
      nextProfile: UserProfile,
      nextScenario: PlanningScenarioId,
      controller: AbortController,
      options?: { forceRefresh?: boolean; reuseAirQuality?: AirQualityContext }
    ) => {
      let resolvedAq: AirQualityContext;
      if (options?.reuseAirQuality) {
        resolvedAq = options.reuseAirQuality;
      } else {
        try {
          resolvedAq = await fetchAirQuality(
            nextProfile.city,
            nextScenario,
            controller.signal,
            Boolean(options?.forceRefresh)
          );
          if (controller.signal.aborted) return;
          setAirQuality(resolvedAq);
          setIsLoadingAq(false);
        } catch (err) {
          if (controller.signal.aborted) return;
          const message =
            err instanceof Error ? err.message : 'Unable to fetch air quality data.';
          setAqError(message);
          resolvedAq = buildEstimatedScenarioContext(
            nextProfile.city,
            'moderate_winter_haze',
            'Live air-quality lookup failed; using an estimated winter haze planning scenario.'
          );
          setAirQuality(resolvedAq);
          setIsLoadingAq(false);
        }
      }

      await generatePlanForContext(nextProfile, resolvedAq, controller.signal);
    },
    [generatePlanForContext]
  );

  const triggerRefresh = useCallback(
    (
      nextProfile: UserProfile,
      nextScenario: PlanningScenarioId,
      options?: { forceRefresh?: boolean; reuseAirQuality?: AirQualityContext }
    ) => {
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      setPlanError(null);
      if (!options?.reuseAirQuality) {
        setIsLoadingAq(true);
        setAqError(null);
      }

      void runRefreshPipeline(nextProfile, nextScenario, controller, options);
    },
    [runRefreshPipeline]
  );

  const initialMountParamsRef = useRef({ profile, scenarioId });

  useEffect(() => {
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const { profile: initialProfile, scenarioId: initialScenario } = initialMountParamsRef.current;
    void runRefreshPipeline(initialProfile, initialScenario, controller);
    return () => {
      controller.abort();
    };
  }, [runRefreshPipeline]);

  const updateProfile = useCallback(
    (nextProfile: UserProfile) => {
      const sameCity =
        nextProfile.city.trim().toLowerCase() === profile.city.trim().toLowerCase();
      setProfile(nextProfile);
      writeStorageJson(PROFILE_STORAGE_KEY, nextProfile);
      if (sameCity && !isLoadingAq && !aqError) {
        triggerRefresh(nextProfile, scenarioId, { reuseAirQuality: airQuality });
      } else {
        triggerRefresh(nextProfile, scenarioId);
      }
    },
    [airQuality, aqError, isLoadingAq, profile.city, scenarioId, triggerRefresh]
  );

  const selectScenario = useCallback(
    (nextScenario: PlanningScenarioId) => {
      setScenarioId(nextScenario);
      triggerRefresh(profile, nextScenario);
    },
    [profile, triggerRefresh]
  );

  const updateCityQuick = useCallback(
    (city: string) => {
      const parsedCity = SafeShortTextSchema(2, 80).safeParse(city);
      if (!parsedCity.success) return;
      const updated = { ...profile, city: parsedCity.data };
      setProfile(updated);
      setScenarioId('live');
      writeStorageJson(PROFILE_STORAGE_KEY, updated);
      triggerRefresh(updated, 'live');
    },
    [profile, triggerRefresh]
  );

  const retryPlanGeneration = useCallback(() => {
    triggerRefresh(profile, scenarioId, { forceRefresh: true });
  }, [profile, scenarioId, triggerRefresh]);

  const toggleChecklistItem = useCallback((id: string) => {
    setCheckedActionIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      writeStorageJson(CHECKLIST_STORAGE_KEY, { date: getTodayDateKey(), ids: next });
      return next;
    });
  }, []);

  const recommendations: StructuredRecommendation[] = useMemo(
    () =>
      planResponse.recommendations && planResponse.recommendations.length > 0
        ? planResponse.recommendations
        : buildDeterministicRecommendations(profile, airQuality),
    [airQuality, planResponse.recommendations, profile]
  );

  const completedCount = useMemo(() => {
    const validIds = new Set(planResponse.checklist.map((item) => item.id));
    return checkedActionIds.filter((id) => validIds.has(id)).length;
  }, [checkedActionIds, planResponse.checklist]);

  return {
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
  };
}
