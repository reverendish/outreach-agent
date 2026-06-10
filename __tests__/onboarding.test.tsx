/**
 * Onboarding page tests
 * Covers: step rendering, canProceed gating, forward/back navigation, finish flow.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Onboarding from '@/app/onboarding/page';
import { db, saveSettings } from '@/src/db';
import { useRouter } from 'next/navigation';

const mockPush = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: mockPush });

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
// Use exact string matches (not regex) to avoid ambiguity between "e.g. Ish"
// and "e.g. Ish Digital" which both match /e.g. Ish/i.
function getYourNameInput()    { return screen.getByPlaceholderText('e.g. Ish'); }
function getProfileNameInput() { return screen.getByPlaceholderText('e.g. Web Dev Services'); }
function getCompanyNameInput() { return screen.getByPlaceholderText('e.g. Ish Digital'); }
function getDescriptionInput() { return screen.getByPlaceholderText(/We build websites/i); }
function getValuePropInput()   { return screen.getByPlaceholderText(/modern website/i); }

async function fillStep0(user: ReturnType<typeof userEvent.setup>) {
  await user.type(getYourNameInput(), 'Ish');
  await user.type(getProfileNameInput(), 'Dev Services');
  await user.type(getCompanyNameInput(), 'Ish Digital');
  await user.type(getDescriptionInput(), 'We build automations for UK SMEs.');
  await user.type(getValuePropInput(), 'Save time, make money.');
}

// ── Step 0: Profile ───────────────────────────────────────────────────────────
describe('Step 0 — Profile', () => {
  it('renders the profile step on initial load', () => {
    render(<Onboarding />);
    expect(screen.getByText(/Set up your workspace/i)).toBeInTheDocument();
    expect(getYourNameInput()).toBeInTheDocument();
  });

  it('shows 3 step indicators', () => {
    render(<Onboarding />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Email style')).toBeInTheDocument();
    expect(screen.getByText('Email sending')).toBeInTheDocument();
  });

  it('Continue button is disabled when fields are empty', () => {
    render(<Onboarding />);
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled();
  });

  it('Continue button enables when all required fields are filled', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await fillStep0(user);
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled();
  });

  it('Back button is not shown on step 0', () => {
    render(<Onboarding />);
    expect(screen.queryByRole('button', { name: /Back/i })).not.toBeInTheDocument();
  });

  it('sector buttons are toggleable', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    const techBtn = screen.getByRole('button', { name: 'Technology' });
    await user.click(techBtn);
    await user.click(techBtn); // toggle off
    expect(techBtn).toBeInTheDocument();
  });

  it('Continue stays disabled if only some fields filled', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.type(getYourNameInput(), 'Ish');
    // only one field — still disabled
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled();
  });
});

// ── Step 0 → Step 1 navigation ────────────────────────────────────────────────
describe('Step 0 → Step 1', () => {
  async function advanceToStep1() {
    const user = userEvent.setup();
    render(<Onboarding />);
    await fillStep0(user);
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    return user;
  }

  it('moves to email style step after completing profile', async () => {
    await advanceToStep1();
    expect(screen.getByText(/Email tone/i)).toBeInTheDocument();
  });

  it('Back button is visible on step 1', async () => {
    await advanceToStep1();
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
  });

  it('Back returns to step 0', async () => {
    const user = await advanceToStep1();
    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(getYourNameInput()).toBeInTheDocument();
  });
});

// ── Step 1: Email style ───────────────────────────────────────────────────────
describe('Step 1 — Email style', () => {
  async function renderStep1() {
    const user = userEvent.setup();
    render(<Onboarding />);
    await fillStep0(user);
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    return user;
  }

  it('renders tone and length options', async () => {
    await renderStep1();
    expect(screen.getByText(/Email tone/i)).toBeInTheDocument();
    expect(screen.getByText(/Default email length/i)).toBeInTheDocument();
  });

  it('Continue is enabled by default (tone + length have defaults)', async () => {
    await renderStep1();
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled();
  });

  it('all four tone buttons are rendered', async () => {
    await renderStep1();
    for (const tone of ['professional', 'conversational', 'direct', 'consultative']) {
      expect(screen.getByRole('button', { name: new RegExp(tone, 'i') })).toBeInTheDocument();
    }
  });

  it('tone buttons are clickable without error', async () => {
    const user = await renderStep1();
    for (const tone of ['professional', 'direct', 'consultative']) {
      await user.click(screen.getByRole('button', { name: new RegExp(tone, 'i') }));
    }
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled();
  });

  it('short / medium / long length options are rendered', async () => {
    await renderStep1();
    expect(screen.getByRole('button', { name: /short/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /long/i })).toBeInTheDocument();
  });
});

// ── Step 2: Email sending ─────────────────────────────────────────────────────
describe('Step 2 — Email sending', () => {
  async function renderStep2() {
    const user = userEvent.setup();
    render(<Onboarding />);
    await fillStep0(user);
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    // Step 1 has defaults — can proceed immediately
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    return user;
  }

  it('shows SES sending address field', async () => {
    await renderStep2();
    expect(screen.getByPlaceholderText(/you@yourdomain.com/i)).toBeInTheDocument();
  });

  it('shows "Finish →" button on last step', async () => {
    await renderStep2();
    expect(screen.getByRole('button', { name: /Finish/i })).toBeInTheDocument();
  });

  it('Finish button is enabled without SES address (field is optional)', async () => {
    await renderStep2();
    expect(screen.getByRole('button', { name: /Finish/i })).not.toBeDisabled();
  });

  it('shows SES setup instructions', async () => {
    await renderStep2();
    expect(screen.getByText(/To verify an address in SES/i)).toBeInTheDocument();
  });

  it('saves profile to DB and redirects on finish', async () => {
    const user = await renderStep2();
    await user.click(screen.getByRole('button', { name: /Finish/i }));
    await waitFor(() => expect(db.profiles.add).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingComplete: true })
      )
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });

  it('saved profile contains the name from step 0', async () => {
    const user = await renderStep2();
    await user.click(screen.getByRole('button', { name: /Finish/i }));
    await waitFor(() => expect(db.profiles.add).toHaveBeenCalledTimes(1));
    const savedProfile = (db.profiles.add as jest.Mock).mock.calls[0][0];
    expect(savedProfile.yourName).toBe('Ish');
    expect(savedProfile.companyName).toBe('Ish Digital');
  });
});
