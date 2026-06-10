// ─── Pipeline & entity types ───────────────────────────────────────────────

export type PipelineStage =
  | 'new'
  | 'enriched'
  | 'contacted'
  | 'replied'
  | 'converted'
  | 'archived';

export type EntityCategory = 'corporate' | 'flagged' | 'unregistered';

export type CampaignType =
  | 'initial_outreach'
  | 'follow_up_sequence'
  | 're_engagement'
  | 'partnership_outreach'
  | 'sector_campaign';

export type EmailMode = 'fully_ai' | 'template_ai_slots' | 'campaign_template';

export type EmailTone = 'professional' | 'conversational' | 'direct' | 'consultative';

export type EmailLength = 'short' | 'medium' | 'long';

// ─── Profile ───────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;                  // e.g. "Web Dev Services"
  companyName: string;
  yourName: string;              // used in {{your_name}} token
  companyDescription: string;   // 1–2 sentences
  targetSectors: string[];       // ["construction", "hospitality", ...]
  valueProposition: string;
  emailTone: EmailTone;
  emailLength: EmailLength;
  createdAt: string;
  updatedAt: string;
}

// ─── Director ──────────────────────────────────────────────────────────────

export interface LinkedInDirectorData {
  jobTitle: string | null;
  seniority: string | null;
  connectionDegree: '1st' | '2nd' | '3rd' | null;
  recentActivityHeadlines: string[];
  profileUrl: string;
  capturedAt: string;
}

export interface Director {
  id: string;
  name: string;
  role: string;                  // "Director", "Secretary", etc.
  appointedOn: string;
  resignedOn: string | null;
  nationality: string | null;
  countryOfResidence: string | null;
  dateOfBirth: {
    month: number;
    year: number;
  } | null;
  address: Record<string, unknown> | null;
  // enrichment additions
  email: string | null;
  emailConfidence: 'high' | 'medium' | 'low' | null;
  phone: string | null;
  phoneSource: string | null;    // "google_business" | "website" | "directory"
  linkedinUrl: string | null;
  linkedinData: LinkedInDirectorData | null;
}

// ─── Enrichment ────────────────────────────────────────────────────────────

export interface NewsArticle {
  headline: string;
  url: string;
  source: string;
  date: string | null;
  excerpt: string;
}

export interface SocialSource {
  platform: string;
  url: string;
  lastActivity: string | null;
  followerCount: number | null;
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
    lastModifiedEstimate: string | null;
  } | null;

  gbp: {
    category: string | null;
    address: string | null;
    phone: string | null;
    hours: string | null;
    reviewRating: number | null;
    reviewCount: number | null;
    recentReviewThemes: string[] | null;
    photosCount: number | null;
    isVerified: boolean | null;
    source: 'gbp' | 'maps' | null;
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

  social: {
    sources: SocialSource[];
    overallPresence: 'active' | 'inactive' | 'none' | null;
  } | null;

  companySize: {
    employeeEstimate: string | null;   // "1-10", "11-50", "51-200", etc.
    revenueEstimate: string | null;    // "< £500k", "£500k–£2m", etc.
    source: string | null;
    confidence: 'high' | 'medium' | 'low' | null;
  } | null;

  credentialsAndAwards: string[] | null;

  activeJobPostings: {
    count: number | null;
    roles: string[] | null;
    source: string | null;
  } | null;

  painPoints: string[] | null;        // max 5, AI-synthesised

  // metadata
  confidenceScore: number;            // 0–100
  conflictingDataFlags: string[];
  sourcesUsed: string[];
  enrichedAt: string;
}

export interface EnrichmentSnapshot {
  snapshotDate: string;
  enrichment: Enrichment;
  changesSummary: string;
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

export interface Contact {
  id: string;

  // source & status
  source: 'manual' | 'csv_import' | 'ch_search' | 'linkedin_extension';
  status: PipelineStage;
  starred: boolean;
  tags: string[];

  // Companies House core
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

  // enrichment
  enrichment: Enrichment | null;
  enrichmentHistory: EnrichmentSnapshot[];
  enrichmentError?: boolean;

  // outreach
  campaignIds: string[];
  sequenceState: SequenceState | null;

  // notes
  notes: Note[];

  // metadata
  createdAt: string;
  updatedAt: string;
  lastEnrichedAt: string | null;
}

// ─── Note ──────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sequence ──────────────────────────────────────────────────────────────

export interface SequenceStep {
  id: string;
  stepNumber: number;
  name: string;
  waitDays: number;
  waitType: 'calendar' | 'business';
  emailMode: EmailMode;
  emailLength: EmailLength;
  templateId: string | null;
  subjectLine: string;
  emailPromptOverride: string | null;
}

export interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  createdAt: string;
  updatedAt: string;
}

export interface SequenceState {
  sequenceId: string;
  currentStepNumber: number;
  status: 'active' | 'paused' | 'completed' | 'manual_review';
  nextSendDue: string | null;
  steps: {
    stepId: string;
    status: 'pending' | 'sent' | 'skipped';
    sentAt: string | null;
    emailId: string | null;
    repliedAt: string | null;
    replyContent: string | null;
    draftedReplyId: string | null;
  }[];
  pauseReason: string | null;
}

// ─── Campaign ──────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  profileId: string;
  name: string;
  type: CampaignType;
  status: 'draft' | 'active' | 'paused' | 'completed';
  defaultEmailMode: EmailMode;
  defaultEmailLength: EmailLength;
  sequenceId: string;
  contactIds: string[];
  liAssessmentId: string | null;
  liAssessmentCompleted: boolean;
  stats: {
    total: number;
    sent: number;
    replied: number;
    optedOut: number;
    converted: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Email draft ───────────────────────────────────────────────────────────

export interface EmailDraft {
  id: string;
  contactId: string;
  campaignId: string | null;
  stepId: string | null;
  subject: string;
  body: string;
  mode: EmailMode;
  generatedAt: string;
  editedAt: string | null;
  status: 'draft' | 'approved' | 'sent' | 'failed';
  sentAt: string | null;
  sesMessageId: string | null;
  approvedForStyleMemory: boolean;
  styleMemoryReviewed: boolean;
}

// ─── Style memory ──────────────────────────────────────────────────────────

export interface StyleMemoryExample {
  id: string;
  profileId: string;
  originalDraft: string;
  approvedVersion: string;
  campaignType: CampaignType;
  stepType: string;   // "initial", "followup_1", etc.
  createdAt: string;
}

// ─── LI Assessment ─────────────────────────────────────────────────────────

export interface LIAssessment {
  id: string;
  campaignId: string;
  profileId: string;
  campaignName: string;
  targetSector: string;
  yourCompanyName: string;
  whatYouDo: string;
  whyThisSector: string;
  valueOffered: string;
  dataSourceDescription: string;
  retentionPeriod: string;
  documentText: string;
  generatedAt: string;
  pdfS3Key: string | null;
  status: 'draft' | 'finalised';
}

// ─── Suppression ───────────────────────────────────────────────────────────

export interface SuppressionEntry {
  email: string;          // lowercase normalised
  optedOutAt: string;
  source: 'unsubscribe_reply' | 'manual' | 'bounce';
  contactId: string | null;
  companyName: string | null;
}

// ─── App settings (stored locally, not in Dexie) ───────────────────────────
// Note: API credentials (Bedrock, Companies House, Brave) are server-side only.

export interface AppSettings {
  activeProfileId: string | null;
  sesFromAddress: string;
  onboardingComplete: boolean;
}

// ─── Entity category mapping ───────────────────────────────────────────────

export const ENTITY_CATEGORY_MAP: Record<string, EntityCategory> = {
  'ltd': 'corporate',
  'plc': 'corporate',
  'llp': 'corporate',
  'limited-partnership': 'corporate',
  'community-interest-company': 'corporate',
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
  contacted: 'Contacted',
  replied: 'Replied',
  converted: 'Converted',
  archived: 'Archived',
};

// ─── Token list for subject lines / templates ──────────────────────────────

export const EMAIL_TOKENS = [
  { token: '{{company_name}}', description: "Contact's company name" },
  { token: '{{director_name}}', description: "Primary director's first name" },
  { token: '{{director_full_name}}', description: "Primary director's full name" },
  { token: '{{your_name}}', description: 'Your name (from profile)' },
  { token: '{{your_company}}', description: 'Your company name (from profile)' },
  { token: '{{sector}}', description: 'SIC description' },
  { token: '{{location}}', description: 'Registered address locality' },
];
