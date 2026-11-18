import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Compass,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { sendAssistantQuestion } from '../services/apiClient.ts';
import { QUICK_ASSISTANT_PROMPTS } from '../shared/constants.ts';
import type {
  AirQualityContext,
  AssistantMessage,
  UserProfile,
} from '../shared/types.ts';
import { SectionHeader } from './ui/Primitives.tsx';

interface AssistantPanelProps {
  profile: UserProfile;
  airQuality: AirQualityContext;
  planSummary: string;
}

let messageSequence = 0;

function createChatMessage(
  role: AssistantMessage['role'],
  content: string,
  extra?: Pick<AssistantMessage, 'structuredReply' | 'mode'>
): AssistantMessage {
  messageSequence += 1;
  return {
    id: `${role}-${Date.now()}-${messageSequence}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function parseStructuredLines(text: string): {
  lead: string | null;
  points: string[];
} {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return { lead: text.trim(), points: [] };
  }

  const lead = !lines[0].startsWith('•') && !lines[0].startsWith('-') ? lines[0] : null;
  const points = (lead ? lines.slice(1) : lines).map((line) =>
    line.replace(/^[•\-*]\s*/, '')
  );

  return { lead, points };
}

export function AssistantPanel({
  profile,
  airQuality,
  planSummary,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const submitQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (trimmed.length < 2) {
      setInputError('Please enter a question of at least 2 characters.');
      return;
    }
    if (trimmed.length > 600) {
      setInputError('Questions must be 600 characters or fewer.');
      return;
    }

    setInputError(null);
    setRequestError(null);

    const userMsg = createChatMessage('user', trimmed);

    const nextHistory = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsSending(true);

    try {
      const response = await sendAssistantQuestion({
        question: trimmed,
        history: nextHistory.slice(-6),
        profile,
        airQuality,
        planSummary,
      });

      const assistantMsg = createChatMessage('assistant', response.reply, {
        structuredReply: response.structuredReply,
        mode: response.mode,
      });
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setRequestError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the assistant right now. Please retry.'
      );
      setQuestion(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitQuestion(question);
  };

  return (
    <section
      id="assistant"
      aria-labelledby="assistant-heading"
      className="scroll-mt-20 surface-card rounded-2xl p-6"
    >
      <SectionHeader
        kicker="Grounded Environmental Guidance"
        title="Ask the Urban Air Quality Assistant"
        titleId="assistant-heading"
        description="Get practical answers tailored strictly to your active city conditions and household setup. Never fabricates live readings or medical diagnoses."
        action={<MessageSquare className="h-5 w-5 text-teal-700" aria-hidden="true" />}
      />

      {/* Active Grounding Context Strip */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-[var(--surface-elevated)] px-3.5 py-2.5 text-xs text-slate-700">
        <span className="font-semibold text-slate-900">Grounded context:</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium">
          <MapPin className="h-3 w-3 text-teal-700" aria-hidden="true" />
          <span>{airQuality.cityResolved}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium font-mono-tabular">
          <Compass className="h-3 w-3 text-sky-700" aria-hidden="true" />
          <span>
            AQI {airQuality.aqi ?? 'N/A'} · {airQuality.category.label}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium">
          <ShieldCheck className="h-3 w-3 text-emerald-700" aria-hidden="true" />
          <span>
            {profile.householdSize} {profile.householdSize === 1 ? 'member' : 'members'} ·{' '}
            {profile.hasHepaFilter ? 'HEPA' : 'No HEPA'}
          </span>
        </span>
      </div>

      {/* Starter Prompt Buttons */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-slate-600">Suggested environmental questions</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {QUICK_ASSISTANT_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isSending}
              onClick={() => void submitQuestion(prompt)}
              className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-semibold text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Structured Conversation Feed */}
      <div
        aria-live="polite"
        aria-label="Assistant conversation"
        className="mt-5 space-y-3.5 rounded-xl border border-slate-200 bg-[var(--surface-elevated)] p-4 min-h-[160px] max-h-[420px] overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-start gap-1.5 py-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">
              Ready to help with today’s routine in {airQuality.cityResolved}
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              Pick a suggested question above or ask about commute timing, cooking ventilation,
              indoor air cleaning, or lower-emission alternatives.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div
                  key={msg.id}
                  className="ml-auto max-w-[85%] rounded-xl bg-teal-700 px-4 py-3 text-sm text-white shadow-xs"
                >
                  <p className="text-[11px] font-semibold text-teal-100">Your Question</p>
                  <p className="mt-0.5 leading-relaxed">{msg.content}</p>
                </div>
              );
            }

            const structured = parseStructuredLines(msg.content);
            return (
              <article
                key={msg.id}
                className="mr-auto max-w-[94%] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-[11px]">
                  <span className="font-bold text-teal-800">ClearAir Environmental Brief</span>
                  {msg.mode && (
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                      {msg.mode === 'gemini_grounded'
                        ? 'AI Grounded'
                        : 'Verified Deterministic Guidance'}
                    </span>
                  )}
                </div>

                {msg.structuredReply ? (
                  <div className="mt-2.5 space-y-2.5">
                    <p className="text-sm font-medium leading-relaxed text-slate-900">
                      {msg.structuredReply.answer}
                    </p>

                    {msg.structuredReply.recommendations.length > 0 && (
                      <ul className="space-y-1.5">
                        {msg.structuredReply.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                            <CheckCircle2
                              className="mt-0.5 h-4 w-4 shrink-0 text-teal-700"
                              aria-hidden="true"
                            />
                            <span className="leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="rounded-lg border border-sky-200/80 bg-sky-50/50 px-3 py-2 text-xs text-slate-800">
                      <strong className="font-semibold text-sky-900">Direct impact: </strong>
                      {msg.structuredReply.impactExplanation}
                    </p>

                    {msg.structuredReply.cautions.length > 0 && (
                      <p className="text-xs text-slate-500">
                        <strong className="font-semibold text-slate-700">Note: </strong>
                        {msg.structuredReply.cautions[0]}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {structured.lead && (
                      <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-900">
                        {structured.lead}
                      </p>
                    )}

                    {structured.points.length > 0 && (
                      <ul className="mt-2.5 space-y-2">
                        {structured.points.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                            <CheckCircle2
                              className="mt-0.5 h-4 w-4 shrink-0 text-teal-700"
                              aria-hidden="true"
                            />
                            <span className="leading-relaxed">{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </article>
            );
          })
        )}

        {isSending && (
          <div className="mr-auto max-w-[75%] rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-500">
            Reviewing your household profile and current air quality…
          </div>
        )}
      </div>

      {requestError && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
        >
          {requestError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4" noValidate>
        <label htmlFor="assistant-question-input" className="sr-only">
          Ask a question about air quality or your daily routine
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="assistant-question-input"
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (inputError) setInputError(null);
            }}
            aria-invalid={Boolean(inputError)}
            aria-describedby={inputError ? 'assistant-input-error' : undefined}
            placeholder="Ask about commute timing, cooking ventilation, or indoor air…"
            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20"
          />
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{isSending ? 'Sending…' : 'Ask Assistant'}</span>
          </button>
        </div>
        {inputError && (
          <p id="assistant-input-error" role="alert" className="mt-1.5 text-xs text-red-700">
            {inputError}
          </p>
        )}
      </form>
    </section>
  );
}
