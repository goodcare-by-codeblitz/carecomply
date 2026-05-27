import * as React from 'react';
import { Pill } from '../ui/pill';

type CarerStatus =
  | 'active' | 'pending' | 'incomplete' | 'expired'
  | 'on_leave' | 'suspended' | 'approved' | 'rejected'
  | 'requested' | 'responded';

const STATUS_MAP: Record<CarerStatus, [React.ComponentProps<typeof Pill>['tone'], string]> = {
  active:     ['ok', 'Active'],
  pending:    ['warn', 'Pending'],
  incomplete: ['warn', 'Incomplete'],
  expired:    ['danger', 'Expired'],
  on_leave:   ['brand', 'On leave'],
  suspended:  ['danger', 'Suspended'],
  approved:   ['ok', 'Approved'],
  rejected:   ['danger', 'Rejected'],
  requested:  ['brand', 'Requested'],
  responded:  ['ok', 'Responded'],
};

export function StatusPill({ s }: { s: CarerStatus | string }) {
  const [tone, label] = STATUS_MAP[s as CarerStatus] ?? ['neutral', s];
  return <Pill tone={tone as any}>{label}</Pill>;
}
