/**
 * Credentials / Integrations settings page tests
 * Covers: all three integrations shown as Connected, no user input required.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import CredentialsSettings from '@/app/settings/credentials/page';

// Shell wraps the page — mock it to render children directly
jest.mock('@/components/Shell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

describe('Credentials / Integrations page', () => {
  it('renders the page heading', () => {
    render(<CredentialsSettings />);
    expect(screen.getByRole('heading', { name: /Integrations/i })).toBeInTheDocument();
  });

  it('explains that no API keys are required from the user', () => {
    render(<CredentialsSettings />);
    expect(screen.getByText(/no API keys required/i)).toBeInTheDocument();
  });

  it('shows Claude (Bedrock) integration', () => {
    render(<CredentialsSettings />);
    expect(screen.getByText(/Claude \(Bedrock\)/i)).toBeInTheDocument();
  });

  it('shows Companies House API integration', () => {
    render(<CredentialsSettings />);
    expect(screen.getByText(/Companies House API/i)).toBeInTheDocument();
  });

  it('shows Brave Search integration', () => {
    render(<CredentialsSettings />);
    expect(screen.getByText(/Brave Search/i)).toBeInTheDocument();
  });

  it('all three integrations show as Connected', () => {
    render(<CredentialsSettings />);
    const connectedBadges = screen.getAllByText(/● Connected/i);
    expect(connectedBadges).toHaveLength(3);
  });

  it('describes what each integration is used for', () => {
    render(<CredentialsSettings />);
    expect(screen.getByText(/Email generation/i)).toBeInTheDocument();
    expect(screen.getByText(/Company search/i)).toBeInTheDocument();
    expect(screen.getByText(/Web enrichment/i)).toBeInTheDocument();
  });

  it('renders inside the Shell', () => {
    render(<CredentialsSettings />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });
});
