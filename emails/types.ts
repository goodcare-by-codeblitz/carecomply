/**
 * Type-safe props shared across the CareComply email templates.
 * These map 1:1 to the dynamic variables passed from Resend / the backend.
 */

export interface TeamInvitationProps {
  /** Organisation the recipient is being invited into. e.g. "Brightpath Care" */
  organizationName: string;
  /** Display name of the person who sent the invite. e.g. "Amara Okafor" */
  inviterName: string;
  /** Recipient's name. Optional — falls back to a neutral greeting if absent. */
  teamMemberName?: string;
  /** Human-readable role label. e.g. "Compliance Officer" */
  roleName: string;
  /** One-line description of what the role can do. */
  roleDescription?: string;
  /** Tokenised, single-use acceptance URL. */
  inviteUrl: string;
  /** Support inbox shown in the footer + security notice. */
  supportEmail: string;
  /** Human-readable expiry, pre-formatted. e.g. "in 7 days (4 June 2026)" */
  expiryTime: string;
  /** Absolute URL to the 88×88 CareComply app icon (PNG/2x for retina). */
  logoUrl?: string;
}

export interface CarerInvitationProps {
  /** The carer / support worker being onboarded. e.g. "Priya" */
  carerName: string;
  /** Organisation they are joining. e.g. "Brightpath Care" */
  organizationName: string;
  /** Who sent the invite (registered manager / coordinator). */
  inviterName: string;
  /** Tokenised, single-use onboarding URL. */
  inviteUrl: string;
  /**
   * Documents the carer will need to upload, pre-resolved by the backend
   * from the organisation's required-document policy.
   */
  requiredDocuments: string[];
  /** Support inbox shown in the help + footer sections. */
  supportEmail: string;
  /** Human-readable expiry, pre-formatted. e.g. "in 14 days (11 June 2026)" */
  expiryTime: string;
  logoUrl?: string;
}

export interface WelcomeTeamMemberProps {
  teamMemberName: string;
  organizationName: string;
  /** Link into the team dashboard. */
  dashboardUrl: string;
  /** Role granted. e.g. "Manager" */
  roleName: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface WelcomeCarerProps {
  carerName: string;
  organizationName: string;
  /** Link into the carer's dashboard. */
  dashboardUrl: string;
  supportEmail: string;
  /** A named human contact at the organisation. e.g. "Amara Okafor" */
  organizationContact: string;
  logoUrl?: string;
}

export interface DocumentExpiryReminderProps {
  /** Carer or team member who owns the document. */
  recipientName: string;
  organizationName: string;
  /** The expiring document. e.g. "Enhanced DBS certificate" */
  documentName: string;
  /** Human-readable expiry date. e.g. "12 June 2026" */
  expiryDate: string;
  /** Whole days until expiry. Negative = already expired. */
  daysRemaining: number;
  /** Link to upload/replace the document. */
  uploadUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface ComplianceWarningProps {
  recipientName: string;
  organizationName: string;
  /** Short description of the compliance risk. e.g. "3 carers have expired documents" */
  warningTitle: string;
  /** Detailed body text explaining the risk. */
  warningDetail: string;
  /** Bullet list of specific items requiring action. */
  actionItems: string[];
  /** Link to the compliance dashboard / action page. */
  actionUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface ReferenceRequestProps {
  /** Person being asked to give the reference. */
  refereeName: string;
  /** The carer the reference is about. */
  carerName: string;
  organizationName: string;
  /** Token-protected reference form URL. */
  referenceFormUrl: string;
  /** Who at the organisation initiated the request. */
  requestedBy: string;
  supportEmail: string;
  /** When the secure link expires. e.g. "21 June 2026" */
  expiryDate: string;
  logoUrl?: string;
}

export interface ReferenceReminderProps {
  refereeName: string;
  carerName: string;
  organizationName: string;
  referenceFormUrl: string;
  /** Days the request has been outstanding. */
  daysPending: number;
  supportEmail: string;
  logoUrl?: string;
}

export interface PasswordResetProps {
  recipientName: string;
  /** Signed, single-use reset URL. */
  resetUrl: string;
  /** Human-readable expiry. e.g. "in 1 hour" */
  expiryTime: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface SubscriptionReceiptProps {
  organizationName: string;
  recipientName: string;
  planName: string;
  invoiceNumber: string;
  /** Pre-formatted amount with currency. e.g. "£149.00" */
  amount: string;
  /** Human-readable billing date. e.g. "28 May 2026" */
  billingDate: string;
  /** Next billing date. e.g. "28 June 2026" */
  nextBillingDate: string;
  /** URL to view/download the invoice. */
  invoiceUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface TrialEndingProps {
  organizationName: string;
  recipientName: string;
  /** Human-readable trial end date. e.g. "5 June 2026" */
  trialEndDate: string;
  /** Whole days until trial ends. */
  daysRemaining: number;
  /** Suggested plan to upgrade to. e.g. "CareComply Pro" */
  planName: string;
  /** Monthly or annual price, pre-formatted. e.g. "£149/month" */
  planPrice: string;
  /** URL to the upgrade / billing page. */
  upgradeUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface DocumentRejectedCarerEmailProps {
  /** The carer who submitted the document. e.g. "Priya" */
  carerName: string;
  /** Organisation the carer belongs to. */
  organizationName: string;
  /** The document that was reviewed and rejected. e.g. "Enhanced DBS certificate" */
  documentName: string;
  /** Plain-language reason the document was rejected, shown prominently. */
  rejectionReason: string;
  /** Name of the person who reviewed it. e.g. "Amara Okafor" */
  reviewerName: string;
  /** Link to upload a corrected version. */
  actionUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface DocumentRejectedManagerEmailProps {
  /** Manager being notified. */
  managerName: string;
  /** The carer whose document was rejected. */
  carerName: string;
  organizationName: string;
  documentName: string;
  /** Reviewer's reason for rejection. */
  rejectionReason: string;
  /** Who reviewed the document. */
  reviewerName: string;
  /** Human-readable note on what this means for compliance. */
  complianceImpact: string;
  /** Link into the carer's profile / compliance issue. */
  actionUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ManagerNotificationEmailProps {
  /** Manager being notified. */
  managerName: string;
  organizationName: string;
  /** Short headline for the event. e.g. "New document submitted for review" */
  title: string;
  /** One-line summary shown under the title. */
  summary: string;
  /** Longer body / context for the event. */
  details: string;
  /** Drives badge colour + label and the inbox preheader urgency. */
  priority: NotificationPriority;
  /** CTA label. e.g. "Review submission" */
  actionLabel: string;
  /** CTA destination. */
  actionUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface PaymentFailedProps {
  organizationName: string;
  recipientName: string;
  /** Subscription plan name. e.g. "CareComply Starter" */
  planName: string;
  /** Pre-formatted amount with currency. e.g. "£29.00" */
  amount: string;
  /** Human-readable date of the failed payment. e.g. "28 May 2026" */
  failureDate: string;
  /** Human-readable next retry date if Stripe will retry. e.g. "4 June 2026" */
  nextRetryDate?: string;
  /** Link to the billing settings page to update payment method. */
  portalUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface PaymentActionRequiredProps {
  organizationName: string;
  recipientName: string;
  /** Subscription plan name. e.g. "CareComply Pro" */
  planName: string;
  /** Pre-formatted amount with currency. e.g. "£59.00" */
  amount: string;
  /** Stripe hosted invoice URL where the customer completes 3DS authentication. */
  actionUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface SubscriptionCanceledProps {
  organizationName: string;
  recipientName: string;
  /** Subscription plan name. e.g. "CareComply Starter" */
  planName: string;
  /** Human-readable date access ends. e.g. "30 May 2026" */
  accessEndDate: string;
  /** Link to the billing settings / resubscribe page. */
  resubscribeUrl: string;
  supportEmail: string;
  logoUrl?: string;
}

export interface ReferenceResponseReceivedEmailProps {
  /** Manager being notified of the submission. */
  managerName: string;
  organizationName: string;
  /** The carer the reference is for. */
  carerName: string;
  /** Person who submitted the reference. */
  refereeName: string;
  /** Referee's job title / organisation. e.g. "Registered Manager, Oakdene Care Home" */
  refereeRole: string;
  /** Whether relationship was confirmed, pre-formatted. e.g. "Yes — line manager for 3 years" */
  relationshipConfirmed: string;
  /** Human-readable submission timestamp. e.g. "29 May 2026, 14:22" */
  submittedDate: string;
  /** Link to review the reference in the app. */
  reviewUrl: string;
  /** Optional trust/confidence signals derived from the submission. */
  trustScore?: { score: string; signals: string[] };
  supportEmail: string;
  logoUrl?: string;
}
