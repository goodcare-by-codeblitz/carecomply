import * as React from 'react';
import { Filter } from 'lucide-react';
import { Pill } from '../ui/pill';

const ROWS = [
  { t: '2m ago',    u: 'imogen.reed@linden',  a: 'Approved document',   e: 'DBS check · Marcus Holloway',       cqc: 'Safe',     sev: 'info'    },
  { t: '14m ago',   u: 'system',              a: 'Sent automatic chase', e: 'Reference · Dr. Helen Whitfield',   cqc: 'Safe',     sev: 'info'    },
  { t: '1h ago',    u: 'kola.adekoya@linden', a: 'Uploaded document',   e: 'Right to Work · P. Subramanian',    cqc: 'Effective',sev: 'info'    },
  { t: '3h ago',    u: 'system',              a: 'Expiry reminder sent', e: 'Manual Handling · H. Wójcik',       cqc: 'Safe',     sev: 'warning' },
  { t: 'Yesterday', u: 'imogen.reed@linden',  a: 'Rejected reference',  e: 'Char. ref. · M. Holloway',          cqc: 'Safe',     sev: 'warning' },
  { t: 'Yesterday', u: 'system',              a: 'Audit export signed',  e: 'carecomply-cqc-audit-linden.xlsx',  cqc: 'Well-led', sev: 'info'    },
];

export function AuditLogPanel() {
  return (
    <div className="rounded-2xl bg-white border border-line shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-semibold text-ink">Audit log</div>
          <Pill tone="ink">Tamper-evident</Pill>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Filter size={11} style={{ width: 11, height: 11 }} />
          6 CQC key questions · 12 categories
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-[#FCFCFD] text-slate-500">
            <tr className="text-left">
              <th className="font-medium px-5 py-2 w-24">Time</th>
              <th className="font-medium py-2">User</th>
              <th className="font-medium py-2">Action</th>
              <th className="font-medium py-2 w-32">CQC</th>
              <th className="font-medium py-2 w-24">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROWS.map((r, i) => (
              <tr key={i} className="row-hover">
                <td className="px-5 py-2.5 font-mono text-[11px] text-slate-500">{r.t}</td>
                <td className="py-2.5 text-ink">{r.u}</td>
                <td className="py-2.5">
                  <span className="text-ink-3">{r.a}</span>{' '}
                  <span className="text-slate-500">· {r.e}</span>
                </td>
                <td className="py-2.5">
                  <Pill tone="brand">{r.cqc}</Pill>
                </td>
                <td className="py-2.5">
                  <Pill tone={r.sev === 'warning' ? 'warn' : 'neutral'}>{r.sev}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
