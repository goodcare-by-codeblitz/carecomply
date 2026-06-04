/**
 * Sample data for every CareComply email template.
 * Use with the React Email preview server or Resend's test endpoint.
 *
 *   npx react-email dev --dir emails/templates
 */
import type {
  TeamInvitationProps,
  CarerInvitationProps,
  WelcomeTeamMemberProps,
  WelcomeCarerProps,
  DocumentExpiryReminderProps,
  ComplianceWarningProps,
  ReferenceRequestProps,
  ReferenceReminderProps,
  PasswordResetProps,
  SubscriptionReceiptProps,
  TrialEndingProps,
} from '../types';

export const teamInvitation: TeamInvitationProps = {
  organizationName: 'Brightpath Care',
  inviterName: 'Amara Okafor',
  teamMemberName: 'Daniel',
  roleName: 'Compliance Officer',
  roleDescription:
    'Full access to the audit log, document reviews and CQC evidence exports. Cannot change billing or remove team members.',
  inviteUrl: 'https://app.carecomply.co.uk/invite/accept?token=ce9f1a4d-7b62-4f0a-9d3e-8a21c6b4f9e2',
  supportEmail: 'support@carecomply.co.uk',
  expiryTime: 'in 7 days (4 June 2026)',
};

export const carerInvitation: CarerInvitationProps = {
  carerName: 'Priya',
  organizationName: 'Brightpath Care',
  inviterName: 'Amara Okafor',
  inviteUrl: 'https://app.carecomply.co.uk/onboarding/start?token=7f3c0a9e-25d1-4b88-b6a2-1e9043c7af55',
  requiredDocuments: [
    'Enhanced DBS certificate',
    'Right to Work in the UK',
    'Proof of address',
    'Mandatory training certificates',
    '2 references (1 work, 1 character)',
  ],
  supportEmail: 'support@carecomply.co.uk',
  expiryTime: 'in 14 days (11 June 2026)',
};

export const welcomeTeamMember: WelcomeTeamMemberProps = {
  teamMemberName: 'Daniel',
  organizationName: 'Brightpath Care',
  dashboardUrl: 'https://app.carecomply.co.uk/dashboard',
  roleName: 'Manager',
  supportEmail: 'support@carecomply.co.uk',
};

export const welcomeCarer: WelcomeCarerProps = {
  carerName: 'Priya',
  organizationName: 'Brightpath Care',
  dashboardUrl: 'https://app.carecomply.co.uk/dashboard',
  supportEmail: 'support@carecomply.co.uk',
  organizationContact: 'Amara Okafor',
};

export const documentExpiryReminder: DocumentExpiryReminderProps = {
  recipientName: 'Priya',
  organizationName: 'Brightpath Care',
  documentName: 'Enhanced DBS certificate',
  expiryDate: '12 June 2026',
  daysRemaining: 14,
  uploadUrl: 'https://app.carecomply.co.uk/documents/upload?ref=dbs-2026',
  supportEmail: 'support@carecomply.co.uk',
};

export const documentExpired: DocumentExpiryReminderProps = {
  ...documentExpiryReminder,
  daysRemaining: -2,
  expiryDate: '26 May 2026',
};

export const complianceWarning: ComplianceWarningProps = {
  recipientName: 'Amara',
  organizationName: 'Brightpath Care',
  warningTitle: '3 carers have expired compliance documents',
  warningDetail:
    'Three members of your care team have documents that have passed their expiry date. This puts your CQC-ready status at risk and must be resolved promptly.',
  actionItems: [
    'Priya Sharma — Enhanced DBS certificate expired 2 days ago',
    'James Osei — Right to Work document expired 5 days ago',
    'Maria Santos — Mandatory training certificates expired today',
  ],
  actionUrl: 'https://app.carecomply.co.uk/compliance',
  supportEmail: 'support@carecomply.co.uk',
};

export const referenceRequest: ReferenceRequestProps = {
  refereeName: 'Mr Okonkwo',
  carerName: 'Priya Sharma',
  organizationName: 'Brightpath Care',
  referenceFormUrl: 'https://app.carecomply.co.uk/reference/form?token=a91f3c8d',
  requestedBy: 'Amara Okafor',
  supportEmail: 'support@carecomply.co.uk',
  expiryDate: '21 June 2026',
};

export const referenceReminder: ReferenceReminderProps = {
  refereeName: 'Mr Okonkwo',
  carerName: 'Priya Sharma',
  organizationName: 'Brightpath Care',
  referenceFormUrl: 'https://app.carecomply.co.uk/reference/form?token=a91f3c8d',
  daysPending: 5,
  supportEmail: 'support@carecomply.co.uk',
};

export const passwordReset: PasswordResetProps = {
  recipientName: 'Amara',
  resetUrl:
    'https://app.carecomply.co.uk/auth/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  expiryTime: 'in 1 hour',
  supportEmail: 'support@carecomply.co.uk',
};

export const subscriptionReceipt: SubscriptionReceiptProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  planName: 'CareComply Pro',
  invoiceNumber: 'INV-2026-0042',
  amount: '£149.00',
  billingDate: '28 May 2026',
  nextBillingDate: '28 June 2026',
  invoiceUrl: 'https://app.carecomply.co.uk/billing/invoices/INV-2026-0042',
  supportEmail: 'support@carecomply.co.uk',
};

export const trialEnding: TrialEndingProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  trialEndDate: '5 June 2026',
  daysRemaining: 3,
  planName: 'CareComply Pro',
  planPrice: '£149/month',
  upgradeUrl: 'https://app.carecomply.co.uk/billing/upgrade',
  supportEmail: 'support@carecomply.co.uk',
};

export const trialEndingEarly: TrialEndingProps = {
  ...trialEnding,
  daysRemaining: 10,
  trialEndDate: '12 June 2026',
};
