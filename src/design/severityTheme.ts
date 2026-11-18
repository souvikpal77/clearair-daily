import type { AqSeverityLevel } from '../shared/types.ts';

export interface SeverityVisualTokens {
  label: string;
  headlineAdvice: string;
  surfaceBg: string;
  surfaceBorder: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentText: string;
  strokeHex: string;
  trackHex: string;
  barBg: string;
  heroGlowClass: string;
}

export const SEVERITY_TOKENS: Record<AqSeverityLevel, SeverityVisualTokens> = {
  good: {
    label: 'Good',
    headlineAdvice: 'Air is crisp and clear — great conditions for outdoor routines.',
    surfaceBg: 'bg-emerald-50/75',
    surfaceBorder: 'border-emerald-200',
    badgeBg: 'bg-emerald-100/90',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300/80',
    accentText: 'text-emerald-800',
    strokeHex: '#059669',
    trackHex: '#d1fae5',
    barBg: 'bg-emerald-600',
    heroGlowClass: 'from-emerald-50/80 via-white to-sky-50/60',
  },
  moderate: {
    label: 'Moderate',
    headlineAdvice: 'Acceptable overall, though roadside traffic zones may irritate sensitive lungs.',
    surfaceBg: 'bg-amber-50/75',
    surfaceBorder: 'border-amber-200',
    badgeBg: 'bg-amber-100/90',
    badgeText: 'text-amber-950',
    badgeBorder: 'border-amber-300/80',
    accentText: 'text-amber-900',
    strokeHex: '#d97706',
    trackHex: '#fef3c7',
    barBg: 'bg-amber-500',
    heroGlowClass: 'from-amber-50/70 via-white to-sky-50/50',
  },
  sensitive: {
    label: 'Unhealthy for Sensitive Groups',
    headlineAdvice: 'Fine haze is building — shorten vigorous outdoor exertion today.',
    surfaceBg: 'bg-orange-50/80',
    surfaceBorder: 'border-orange-200',
    badgeBg: 'bg-orange-100/90',
    badgeText: 'text-orange-950',
    badgeBorder: 'border-orange-300/80',
    accentText: 'text-orange-900',
    strokeHex: '#ea580c',
    trackHex: '#ffedd5',
    barBg: 'bg-orange-500',
    heroGlowClass: 'from-orange-50/70 via-white to-slate-50',
  },
  unhealthy: {
    label: 'Unhealthy',
    headlineAdvice: 'Outdoor exposure should be reduced today — shift exercise indoors.',
    surfaceBg: 'bg-rose-50/80',
    surfaceBorder: 'border-rose-200',
    badgeBg: 'bg-rose-100/90',
    badgeText: 'text-rose-950',
    badgeBorder: 'border-rose-300/80',
    accentText: 'text-rose-900',
    strokeHex: '#e11d48',
    trackHex: '#ffe4e6',
    barBg: 'bg-rose-600',
    heroGlowClass: 'from-rose-50/75 via-white to-amber-50/40',
  },
  very_unhealthy: {
    label: 'Very Unhealthy',
    headlineAdvice: 'Severe winter smog conditions — avoid non-essential outdoor activity.',
    surfaceBg: 'bg-red-50/85',
    surfaceBorder: 'border-red-300',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-950',
    badgeBorder: 'border-red-300',
    accentText: 'text-red-900',
    strokeHex: '#be123c',
    trackHex: '#fecdd3',
    barBg: 'bg-red-700',
    heroGlowClass: 'from-red-50/80 via-white to-slate-50',
  },
  hazardous: {
    label: 'Hazardous',
    headlineAdvice: 'Emergency air episode — remain indoors with filtered air and follow local alerts.',
    surfaceBg: 'bg-red-100/80',
    surfaceBorder: 'border-red-300',
    badgeBg: 'bg-red-200/80',
    badgeText: 'text-red-950',
    badgeBorder: 'border-red-400',
    accentText: 'text-red-950',
    strokeHex: '#9f1239',
    trackHex: '#fecaca',
    barBg: 'bg-red-900',
    heroGlowClass: 'from-red-100/70 via-white to-slate-50',
  },
};

export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
