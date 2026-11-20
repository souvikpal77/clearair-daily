import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { buildEstimatedScenarioContext } from '../../core/aqCategorizer';
import { buildActionChecklist, buildDeterministicPlan } from '../../core/fallbackPlanner';
import { DEFAULT_USER_PROFILE, RESPONSIBLE_AI_DISCLAIMER } from '../../shared/constants';

function installMockFetch(options?: { failAssistant?: boolean }) {
  const aq = buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze');
  const plan = buildDeterministicPlan(DEFAULT_USER_PROFILE, aq);
  const checklist = buildActionChecklist(DEFAULT_USER_PROFILE, aq);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/air-quality')) {
        return new Response(JSON.stringify(aq), { status: 200 });
      }
      if (url.includes('/api/plan/generate')) {
        return new Response(
          JSON.stringify({
            plan,
            checklist,
            generationMode: 'deterministic_fallback',
            fallbackNotice: null,
            generatedAt: '2026-11-18T12:00:00.000Z',
            disclaimer: RESPONSIBLE_AI_DISCLAIMER,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/assistant/chat')) {
        if (options?.failAssistant) {
          return new Response(JSON.stringify({ error: 'Assistant temporarily offline' }), {
            status: 503,
          });
        }
        return new Response(
          JSON.stringify({
            reply: 'In Delhi under Moderate Winter Haze, prefer metro transit if practical.',
            mode: 'deterministic_fallback',
            groundedContextSummary: 'Delhi · US AQI 128',
            disclaimer: RESPONSIBLE_AI_DISCLAIMER,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('ClearAir Daily UI flows', () => {
  it('renders Air Quality Context, Hero greeting, radial gauge, Clean-Air Priorities, Direct Impact Explainer, and Responsible AI notice', async () => {
    installMockFetch();
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /Let’s plan a cleaner day in Delhi\./i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Air Quality Context & Decision Brief/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Your Clean-Air Priorities/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Direct Impact Explainer/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Informational guidance only/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('128')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /Air Quality Index 128/i })).toBeInTheDocument();
      expect(screen.getByText(/Today’s Air Signal/i)).toBeInTheDocument();
      expect(screen.getByText(/Current condition/i)).toBeInTheDocument();
      expect(screen.getByText(/Why it matters/i)).toBeInTheDocument();
    });

    const indoorNavButtons = screen.getAllByRole('button', { name: /Indoor Air/i });
    fireEvent.click(indoorNavButtons[0]);
    expect(indoorNavButtons[0]).toHaveAttribute('aria-current', 'page');
  });

  it('validates city input errors and prevents invalid submission', async () => {
    installMockFetch();
    render(<App />);

    const checkBtn = screen.getByRole('button', { name: /Check city air quality/i });
    await waitFor(() => expect(checkBtn).toBeEnabled());

    const cityInput = screen.getByLabelText(/City or urban area/i);
    fireEvent.change(cityInput, { target: { value: 'A' } });
    fireEvent.click(checkBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/2 and 80 characters/i);
  });

  it('tracks daily checklist toggles and updates progress count', async () => {
    installMockFetch();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/0 of 6 completed/i)).toBeInTheDocument();
    });

    const firstCheckbox = screen.getByLabelText(/Check morning conditions/i);
    fireEvent.click(firstCheckbox);

    expect(screen.getByText(/1 of 6 completed/i)).toBeInTheDocument();
  });

  it('opens and closes ProfileModal via Escape and saves updated household settings', async () => {
    installMockFetch();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Update Profile/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Update Profile/i }));
    const householdInput = screen.getByLabelText(/Household size/i);
    fireEvent.change(householdInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & Refresh Plan/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/5 people/i)).toBeInTheDocument();
  });

  it('handles assistant starter prompt and preserves input if request fails', async () => {
    installMockFetch();
    render(<App />);

    const quickBtn = screen.getByRole('button', {
      name: /How should I plan my commute today\?/i,
    });
    fireEvent.click(quickBtn);

    expect(
      await screen.findByText(/prefer metro transit if practical/i)
    ).toBeInTheDocument();

    installMockFetch({ failAssistant: true });
    const input = screen.getByLabelText(/Ask a question about air quality/i);
    fireEvent.change(input, { target: { value: 'Should I open bedroom windows?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    expect(await screen.findByText(/Assistant temporarily offline/i)).toBeInTheDocument();
    expect(input).toHaveValue('Should I open bedroom windows?');
  });

  it('recovers safely from malformed or XSS-tainted localStorage state and escapes HTML-like assistant output', async () => {
    window.localStorage.setItem('clearair_daily_profile_v1', '{broken-json');
    window.localStorage.setItem(
      'clearair_daily_checklist_v1',
      JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        ids: Array.from({ length: 30 }, (_, i) => `item-${i}`),
      })
    );

    const aq = buildEstimatedScenarioContext('Delhi', 'moderate_winter_haze');
    const plan = buildDeterministicPlan(DEFAULT_USER_PROFILE, aq);
    const checklist = buildActionChecklist(DEFAULT_USER_PROFILE, aq);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/air-quality')) {
          return new Response(JSON.stringify(aq), { status: 200 });
        }
        if (url.includes('/api/plan/generate')) {
          return new Response(
            JSON.stringify({
              plan,
              checklist,
              generationMode: 'deterministic_fallback',
              fallbackNotice: null,
              generatedAt: '2026-11-18T12:00:00.000Z',
              disclaimer: RESPONSIBLE_AI_DISCLAIMER,
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            reply: 'Safe guidance <img src=x onerror=alert(1)> for Delhi.',
            mode: 'deterministic_fallback',
            groundedContextSummary: 'Delhi · US AQI 128',
            disclaimer: RESPONSIBLE_AI_DISCLAIMER,
          }),
          { status: 200 }
        );
      })
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { name: /Let’s plan a cleaner day in Delhi\./i })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/0 of 6 completed/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/Ask a question about air quality/i);
    fireEvent.change(input, { target: { value: 'Is indoor air safe?' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Assistant/i }));

    expect(await screen.findByText(/Safe guidance <img src=x onerror=alert\(1\)> for Delhi\./i)).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });
});
