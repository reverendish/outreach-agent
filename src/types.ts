// ─── Pipeline ──────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'new'
  | 'enriched'
  | 'draft_ready'   // enriched + draft generated, not yet reviewed
  | 'review'        // draft reviewed, approved to send
  | 'contacted'
  | 'replied'
  | 'converted'
  | 'archived';

export type EntityCategory = 'corporate' | 'flagged' | 'unregistered';

export type EmailTone = 'professional' | 'conversational' | 'direct' | 'consultative';
export type EmailLength = 'short' | 'medium' | 'long';

// ─── Account ───────────────────────────────────────────────────────────────

export interface AutomationToggles {
  autoEnrich: boolean;
  autoGenerate: boolean;
  autoSend: boolean;        // only unlocks after trust ramp
  autoFollowup: boolean;
}

export interface SendingConfig {
  provider: 'ses' | 'resend' | 'smtp';
  fromAddress: string;
  fromName: string;
  // SES: nothing extra (uses IAM role)
  // Resend: apiKey stored in SSM
  // SMTP: host/port/user/pass stored encrypted in DynamoDB
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
}

export interface Account {
  userId: string;            // Google sub or email — DynamoDB partition key
  email: string;
  name: string | null;
  displayName?: string;
  replyToEmail?: string;
  avatarUrl: string | null;

  // Sender profile
  yourName: string;
  companyName: string;
  companyDescription: string;
  valueProposition: string;
  targetSectors: string[];
  emailTone: EmailTone;
  emailLength: EmailLength;

  // Sending
  sending: SendingConfig | null;

  // Automation
  automation: AutomationToggles;
  manualSendCount: number;   // trust ramp: autoSend unlocks at 5
  dailySendCap: number;      // auto-send respects this

  // Meta
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Director ──────────────────────────────────────────────────────────────

export interface Director {
  id: string;
  name: string;
  role: string;
  appointedOn: string;
  resignedOn: string | null;
  nationality: string | null;
  countryOfResidence: string | null;
  dateOfBirth: { month: number; year: number } | null;
  address: Record<string, unknown> | null;
  email: string | null;
  emailConfidence: 'high' | 'medium' | 'low' | null;
  phone: string | null;
  linkedinUrl: string | null;
}

// ─── Enrichment ────────────────────────────────────────────────────────────

export interface NewsArticle {
  headline: string;
  url: string;
  source: string;
  date: string | null;
  excerpt: string;
}

export interface DirectorChange {
  name: string;
  role: string;
  type: 'appointment' | 'resignation';
  date: string;
}

export interface Enrichment {
  website: {
    url: string | null;
    lastChecked: string;
    isActive: boolean;
    title: string | null;
    metaDescription: string | null;
    techStack: string[] | null;
    hasBlog: boolean | null;
    hasLivechat: boolean | null;
    mobileScore: 'good' | 'poor' | 'unknown' | null;
  } | null;

  gbp: {
    category: string | null;
    address: string | null;
    phone: string | null;
    reviewRating: number | null;
    reviewCount: number | null;
    recentReviewThemes: string[] | null;
    isVerified: boolean | null;
    source: string | null;
  } | null;

  filings: {
    lastConfirmationStatement: string | null;
    confirmationStatementOverdue: boolean;
    activeCharges: number;
    recentDirectorChanges: DirectorChange[];
    dormantFlag: boolean;
  } | null;

  news: {
    articles: NewsArticle[];
    overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
    lastMentionDate: string | null;
  } | null;

  companySize: {
    employeeEstimate: string | null;
    revenueEstimate: string | null;
    confidence: 'high' | 'medium' | 'low' | null;
  } | null;

  painPoints: string[] | null;        // max 5, AI-synthesised
  whyContactNow: string | null;       // hero signal: one sentence, AI-synthesised

  confidenceScore: number;
  sourcesUsed: string[];
  enrichedAt: string;
}

// ─── Contact ───────────────────────────────────────────────────────────────

export interface RegisteredAddress {
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  region?: string;
  postalCode: string;
  country: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  accountId: string;         // matches Account.userId

  source: 'manual' | 'ch_search';
  status: PipelineStage;
  starred: boolean;
  tags: string[];

  ch: {
    companyNumber: string;
    companyName: string;
    companyType: string;
    entityCategory: EntityCategory;
    registeredAddress: RegisteredAddress;
    incorporationDate: string;
    sicCodes: string[];
    sicDescriptions: string[];
    status: string;
  } | null;

  directors: Director[];

  enrichment: Enrichment | null;
  enrichmentError?: boolean;

  latestDraftId: string | null;  // pointer to most recent EmailDraft

  notes: Note[];
  suppressedEmails: string[];    // emails that have opted out

  createdAt: string;
  updatedAt: string;
  lastEnrichedAt: string | null;
}

// ─── Email draft ───────────────────────────────────────────────────────────

export type DraftStatus = 'draft' | 'approved' | 'sent' | 'failed';

export interface EmailDraft {
  id: string;
  accountId: string;
  contactId: string;
  subject: string;
  body: string;
  generatedAt?: string;
  editedAt?: string | null;
  status: DraftStatus;
  sentAt: string | null;
  messageId?: string | null;     // SES/Resend message ID
  provider: 'ses' | 'resend' | 'smtp' | null;
  isFollowup: boolean;
  followupNumber: number;        // 0 = initial, 1 = first followup, etc.
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Suppression ───────────────────────────────────────────────────────────

export interface SuppressionEntry {
  accountId: string;
  email: string;
  optedOutAt: string;
  source: 'unsubscribe_reply' | 'manual' | 'bounce';
  contactId: string | null;
  companyName: string | null;
}

// ─── Entity category mapping ───────────────────────────────────────────────

export const ENTITY_CATEGORY_MAP: Record<string, EntityCategory> = {
  'ltd': 'corporate', 'plc': 'corporate', 'llp': 'corporate',
  'limited-partnership': 'corporate', 'community-interest-company': 'corporate',
  'scottish-limited-partnership': 'corporate',
  'scottish-limited-liability-partnership': 'corporate',
  'charitable-incorporated-organisation': 'flagged',
  'industrial-and-provident-society': 'flagged',
  'registered-society': 'flagged',
  'royal-charter': 'flagged',
};

export function mapEntityCategory(chType: string): EntityCategory {
  return ENTITY_CATEGORY_MAP[chType?.toLowerCase()] ?? 'unregistered';
}

// ─── Pipeline stage labels ─────────────────────────────────────────────────

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  enriched: 'Enriched',
  draft_ready: 'Draft ready',
  review: 'Needs review',
  contacted: 'Contacted',
  replied: 'Replied',
  converted: 'Converted',
  archived: 'Archived',
};

// Next action each stage implies — powers the omotenashi dashboard
export const STAGE_NEXT_ACTION: Record<PipelineStage, string> = {
  new: 'Run enrichment',
  enriched: 'Generate draft',
  draft_ready: 'Review draft',
  review: 'Send email',
  contacted: 'Awaiting reply',
  replied: 'Review reply',
  converted: '—',
  archived: '—',
};
