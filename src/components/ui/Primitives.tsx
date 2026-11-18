import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { SEVERITY_TOKENS } from '../../design/severityTheme.ts';
import type { AqSeverityLevel } from '../../shared/types.ts';

interface StatusBadgeProps {
  level: AqSeverityLevel;
  labelOverride?: string;
}

export function StatusBadge({ level, labelOverride }: StatusBadgeProps) {
  const tokens = SEVERITY_TOKENS[level];

  const Icon =
    level === 'good'
      ? CheckCircle2
      : level === 'moderate'
        ? Info
        : level === 'sensitive'
          ? AlertTriangle
          : ShieldAlert;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${tokens.badgeBg} ${tokens.badgeText} ${tokens.badgeBorder}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{labelOverride ?? tokens.label}</span>
    </span>
  );
}

interface SectionHeaderProps {
  kicker: string;
  title: string;
  titleId: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({
  kicker,
  title,
  titleId,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-teal-800">{kicker}</p>
        <h2
          id={titleId}
          className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-[22px]"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface AirQualityGaugeProps {
  aqi: number | null;
  level: AqSeverityLevel;
  categoryLabel: string;
  isEstimated: boolean;
}

export function AirQualityGauge({
  aqi,
  level,
  categoryLabel,
  isEstimated,
}: AirQualityGaugeProps) {
  const tokens = SEVERITY_TOKENS[level];

  // 240-degree radial arc gauge (from 150deg to 390deg)
  const size = 168;
  const strokeWidth = 13;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 240 / 360;
  const arcLength = circumference * arcFraction;

  const clampedRatio =
    aqi !== null && Number.isFinite(aqi) ? Math.min(1, Math.max(0.04, aqi / 300)) : 0;
  const filledLength = arcLength * clampedRatio;

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      role="img"
      aria-label={`Air Quality Index ${aqi !== null ? aqi : 'unavailable'}, category ${categoryLabel}${isEstimated ? ', estimated planning scenario' : ''}`}
    >
      <svg
        width={size}
        height={138}
        viewBox={`0 0 ${size} ${size - 18}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={tokens.trackHex}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(150 ${center} ${center})`}
        />
        {/* Value arc */}
        {aqi !== null && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={tokens.strokeHex}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${circumference}`}
            transform={`rotate(150 ${center} ${center})`}
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
        <span className="text-[11px] font-semibold tracking-wider text-slate-500">
          US AQI
        </span>
        <span
          className={`mt-0.5 text-4xl font-bold tracking-tight font-mono-tabular ${tokens.accentText}`}
        >
          {aqi !== null ? aqi : 'N/A'}
        </span>
        <span className="mt-1 text-[11px] font-medium text-slate-500">
          {isEstimated ? 'Estimated' : 'Live index'}
        </span>
      </div>

      <div className="mt-1 flex w-40 justify-between text-[11px] font-medium text-slate-500 font-mono-tabular">
        <span>0</span>
        <span>150</span>
        <span>300+</span>
      </div>
    </div>
  );
}
