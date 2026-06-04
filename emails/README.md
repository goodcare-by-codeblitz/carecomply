# CareComply Email System

React Email + Resend template system for all CareComply transactional emails.

## Usage with Resend

```ts
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { TeamInvitation } from '@/emails';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'CareComply <invites@carecomply.co.uk>',
  to: 'recipient@example.com',
  subject: "You're invited to join Brightpath Care on CareComply",
  react: (
    <TeamInvitation
      organizationName="Brightpath Care"
      inviterName="Amara Okafor"
      roleName="Compliance Officer"
      inviteUrl="https://app.carecomply.co.uk/invite/accept?token=..."
      supportEmail="support@carecomply.co.uk"
      expiryTime="in 7 days (4 June 2026)"
    />
  ),
});
```

## Local preview

```bash
npx react-email dev --dir emails/templates
```

## Templates

| Template | File | Trigger |
|---|---|---|
| Team Invitation | `TeamInvitation.tsx` | Staff member invited to workspace |
| Carer Invitation | `CarerInvitation.tsx` | Carer invited to onboard |
| Welcome Team Member | `WelcomeTeamMember.tsx` | Staff registration complete |
| Welcome Carer | `WelcomeCarer.tsx` | Carer onboarding complete |
| Document Expiry Reminder | `DocumentExpiryReminder.tsx` | Document approaching/past expiry |
| Compliance Warning | `ComplianceWarning.tsx` | Manager alert: compliance risk |
| Reference Request | `ReferenceRequest.tsx` | Sent to referee |
| Reference Reminder | `ReferenceReminder.tsx` | Follow-up to referee |
| Password Reset | `PasswordReset.tsx` | Password reset requested |
| Subscription Receipt | `SubscriptionReceipt.tsx` | Payment confirmed |
| Trial Ending | `TrialEnding.tsx` | Trial nearing expiry |

## Folder structure

```
emails/
├── components/        # Shared layout primitives
├── templates/         # One file per email type
├── preview/           # Sample data for local dev
├── theme.ts           # Design tokens (colours, type, spacing)
├── styles.ts          # Shared inline style objects
├── types.ts           # TypeScript prop interfaces
└── index.ts           # Barrel export
```
