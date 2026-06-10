import Dexie, { type Table } from 'dexie';
import type {
  Contact,
  Profile,
  Campaign,
  Sequence,
  EmailDraft,
  StyleMemoryExample,
  LIAssessment,
  SuppressionEntry,
} from './types';

export class OutreachDB extends Dexie {
  contacts!: Table<Contact, string>;
  profiles!: Table<Profile, string>;
  campaigns!: Table<Campaign, string>;
  sequences!: Table<Sequence, string>;
  emailDrafts!: Table<EmailDraft, string>;
  styleMemory!: Table<StyleMemoryExample, string>;
  liAssessments!: Table<LIAssessment, string>;
  suppression!: Table<SuppressionEntry, string>;

  constructor() {
    super('outreach-agent');

    this.version(1).stores({
      // contacts: primary key id, indexes on status, starred, tags, ch.companyNumber, lastEnrichedAt
      contacts: 'id, status, starred, lastEnrichedAt, createdAt, [status+starred]',

      // profiles: primary key id
      profiles: 'id, createdAt',

      // campaigns: primary key id, index on profileId and status
      campaigns: 'id, profileId, status, type, createdAt',

      // sequences: primary key id
      sequences: 'id, createdAt',

      // email drafts: primary key id, indexes for lookups
      emailDrafts: 'id, contactId, campaignId, status, generatedAt',

      // style memory: primary key id, query by profileId + campaignType
      styleMemory: 'id, profileId, campaignType, createdAt',

      // LI assessments: primary key id, query by campaignId
      liAssessments: 'id, campaignId, profileId',

      // suppression: primary key email (lowercase normalised)
      suppression: 'email, optedOutAt',
    });
  }
}

export const db = new OutreachDB();

// ─── Settings helpers (stored in localStorage, not Dexie) ──────────────────
// Credentials and app-level config are NOT stored in IndexedDB to keep them
// out of structured storage that could be exported accidentally.

const SETTINGS_KEY = 'outreach_settings';

export interface StoredSettings {
  activeProfileId: string | null;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  braveApiKey: string;
  sesFromAddress: string;
  dailySendLimit: number;
  onboardingComplete: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  activeProfileId: null,
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsRegion: 'eu-west-2',
  braveApiKey: '',
  sesFromAddress: '',
  dailySendLimit: 50,
  onboardingComplete: false,
};

export function getSettings(): StoredSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(patch: Partial<StoredSettings>): void {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
}

// ─── Convenience: get active profile ───────────────────────────────────────

export async function getActiveProfile(): Promise<Profile | undefined> {
  const { activeProfileId } = getSettings();
  if (!activeProfileId) return undefined;
  return db.profiles.get(activeProfileId);
}

// ─── UUID helper (no dependency needed — crypto.randomUUID is available) ───

export function newId(): string {
  return crypto.randomUUID();
}
