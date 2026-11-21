import type {
  AirQualityContext,
  AqSeverityLevel,
  DataFreshness,
  DataSourceKind,
  UserProfile,
} from '../shared/types.ts';
import { isUnhealthyOrWorseLevel } from './aqCategorizer.ts';

export function formatDataFreshness(
  observedAt: string | null,
  dataSource: DataSourceKind,
  now: Date = new Date()
): DataFreshness {
  if (dataSource !== 'live' || !observedAt) {
    return {
      status: dataSource === 'scenario_estimate' ? 'estimated' : 'unavailable',
      label: 'Estimated planning scenario',
      detail: 'Not live sensor data',
      isLive: false,
    };
  }

  const parsed = new Date(observedAt);
  if (Number.isNaN(parsed.getTime())) {
    return {
      status: 'live_fresh',
      label: `Observed ${observedAt}`,
      detail: 'Live regional telemetry',
      isLive: true,
    };
  }

  const diffMs = now.getTime() - parsed.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin >= 0 && diffMin < 2) {
    return {
      status: 'live_fresh',
      label: 'Updated just now',
      detail: 'Live regional telemetry',
      isLive: true,
    };
  }

  if (diffMin >= 2 && diffMin < 60) {
    return {
      status: 'live_fresh',
      label: `Updated ${diffMin} min ago`,
      detail: 'Live regional telemetry',
      isLive: true,
    };
  }

  if (diffMin >= 60 && diffMin < 24 * 60) {
    const hours = Math.round(diffMin / 60);
    return {
      status: hours <= 3 ? 'live_fresh' : 'live_stale',
      label: `Updated ${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`,
      detail: hours <= 3 ? 'Live regional telemetry' : 'Older regional observation',
      isLive: true,
    };
  }

  const formattedDate = parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    status: 'live_stale',
    label: `Observed ${formattedDate}`,
    detail: 'Older regional observation',
    isLive: true,
  };
}

export interface AirSignalItem {
  id: 'outdoor' | 'indoor' | 'travel';
  domain: string;
  actionLabel: string;
  statusLevel: 'alert' | 'caution' | 'positive';
}

export function buildTodaysAirSignals(
  airQuality: AirQualityContext,
  profile: UserProfile
): AirSignalItem[] {
  const level: AqSeverityLevel = airQuality.category.level;
  const isPoorOrWorse = isUnhealthyOrWorseLevel(level);
  const isSensitiveOrModerate = level === 'sensitive' || level === 'moderate';

  const outdoorSignal: AirSignalItem = isPoorOrWorse
    ? {
        id: 'outdoor',
        domain: 'Outdoor',
        actionLabel: 'Reduce outdoor exposure',
        statusLevel: 'alert',
      }
    : isSensitiveOrModerate
      ? {
          id: 'outdoor',
          domain: 'Outdoor',
          actionLabel:
            level === 'sensitive'
              ? 'Shorten strenuous outdoor exertion'
              : 'Prefer low-traffic outdoor routes',
          statusLevel: 'caution',
        }
      : {
          id: 'outdoor',
          domain: 'Outdoor',
          actionLabel: 'Safe for normal outdoor routines',
          statusLevel: 'positive',
        };

  const indoorSignal: AirSignalItem = isPoorOrWorse
    ? {
        id: 'indoor',
        domain: 'Indoor',
        actionLabel: profile.hasHepaFilter
          ? 'Keep windows closed & run HEPA'
          : 'Keep windows closed & control indoor smoke',
        statusLevel: 'alert',
      }
    : level === 'sensitive' || profile.cookingFuel === 'gas_stove'
      ? {
          id: 'indoor',
          domain: 'Indoor',
          actionLabel: 'Keep indoor air clean & vent cooking',
          statusLevel: 'caution',
        }
      : {
          id: 'indoor',
          domain: 'Indoor',
          actionLabel: 'Brief midday cross-ventilation OK',
          statusLevel: 'positive',
        };

  const travelSignal: AirSignalItem =
    profile.commuteMode === 'car_solo'
      ? {
          id: 'travel',
          domain: 'Travel',
          actionLabel: 'Prefer lower-emission travel',
          statusLevel: 'positive',
        }
      : {
          id: 'travel',
          domain: 'Travel',
          actionLabel: isPoorOrWorse
            ? 'Minimize roadside wait times'
            : 'Low-emission commute active',
          statusLevel: isPoorOrWorse ? 'caution' : 'positive',
        };

  return [outdoorSignal, indoorSignal, travelSignal];
}
