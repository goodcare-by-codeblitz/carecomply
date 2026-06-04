// ── Templates ────────────────────────────────────────────────────────────────
export { TeamInvitation } from './templates/TeamInvitation';
export { CarerInvitation } from './templates/CarerInvitation';
export { WelcomeTeamMember } from './templates/WelcomeTeamMember';
export { WelcomeCarer } from './templates/WelcomeCarer';
export { DocumentExpiryReminder } from './templates/DocumentExpiryReminder';
export { ComplianceWarning } from './templates/ComplianceWarning';
export { ReferenceRequest } from './templates/ReferenceRequest';
export { ReferenceReminder } from './templates/ReferenceReminder';
export { PasswordReset } from './templates/PasswordReset';
export { SubscriptionReceipt } from './templates/SubscriptionReceipt';
export { TrialEnding } from './templates/TrialEnding';
export { PaymentFailed } from './templates/PaymentFailed';
export { PaymentActionRequired } from './templates/PaymentActionRequired';
export { SubscriptionCanceled } from './templates/SubscriptionCanceled';
export { DocumentRejectedCarerEmail } from './templates/DocumentRejectedCarerEmail';
export { DocumentRejectedManagerEmail } from './templates/DocumentRejectedManagerEmail';
export { ManagerNotificationEmail } from './templates/ManagerNotificationEmail';
export { ReferenceResponseReceivedEmail } from './templates/ReferenceResponseReceivedEmail';

// ── Layout & shared components ───────────────────────────────────────────────
export { EmailLayout } from './components/EmailLayout';
export { EmailHeader } from './components/EmailHeader';
export { EmailFooter } from './components/EmailFooter';
export { EmailButton } from './components/EmailButton';
export { EmailCard } from './components/EmailCard';
export { EmailSection, SectionLabel, SectionText } from './components/EmailSection';
export { RoleCard } from './components/RoleCard';
export { StepList } from './components/StepList';
export { DocumentCard } from './components/DocumentCard';
export { DetailCard } from './components/DetailCard';
export { StatusCard } from './components/StatusCard';
export { Checklist } from './components/Checklist';
export { HelpSection } from './components/HelpSection';
export { SecurityNotice } from './components/SecurityNotice';
export { FeedbackCard } from './components/FeedbackCard';
export { TrustBadges } from './components/TrustBadges';

// ── Design tokens & shared styles ────────────────────────────────────────────
export * from './theme';
export * as styles from './styles';

// ── TypeScript types ──────────────────────────────────────────────────────────
export type {
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
  PaymentFailedProps,
  PaymentActionRequiredProps,
  SubscriptionCanceledProps,
  DocumentRejectedCarerEmailProps,
  DocumentRejectedManagerEmailProps,
  ManagerNotificationEmailProps,
  NotificationPriority,
  ReferenceResponseReceivedEmailProps,
} from './types';
export type { OnboardingStep } from './components/StepList';
export type { DetailRow } from './components/DetailCard';
export type { StatusTone } from './components/StatusCard';
