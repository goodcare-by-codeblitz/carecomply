import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { AuditExportManifest } from './audit-export-signing';
import { buildAuditExportWorkbook } from './audit-export-workbook';

describe('audit export workbook', () => {
	it('builds a styled multi-sheet workbook with verification metadata', async () => {
		const logs: Record<string, unknown>[] = [
			{
				created_at: '2026-06-02T09:15:00.000Z',
				user_email: 'manager@example.com',
				action: 'document.approved',
				entity_type: 'document',
				entity_name: 'DBS check',
				category: 'documents',
				severity: 'info',
				cqc_key_question: 'safe',
				source: 'dashboard',
				ip_address: '127.0.0.1',
				details: { carer_name: 'Imogen Reed', user_agent: 'hidden' },
			},
		];
		const manifest: AuditExportManifest = {
			exportId: 'export-1',
			organizationId: 'org-1',
			organizationSlug: 'linden',
			format: 'xlsx',
			generatedAt: '2026-06-02T10:00:00.000Z',
			rowCount: logs.length,
			filters: { entity_type: 'document' },
			rowsHash: 'rows-hash',
		};

		const buffer = await buildAuditExportWorkbook(
			logs,
			{
				orgName: 'Linden Domiciliary',
				orgSlug: 'linden',
				dateFrom: null,
				dateTo: null,
				generatedAt: new Date(manifest.generatedAt),
				filters: manifest.filters,
			},
			{
				manifest,
				manifestHash: 'manifest-hash',
				signature: 'signature',
			},
			{ worksheetProtectionSpinCount: 1 },
		);
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer);

		expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
			'Overview',
			'CQC Summary',
			'Audit Logs',
			'Verification',
		]);

		const overview = workbook.getWorksheet('Overview');
		const auditLogs = workbook.getWorksheet('Audit Logs');
		const verification = workbook.getWorksheet('Verification');

		expect(overview?.getCell('A1').value).toBe('CareComply CQC Audit Export');
		expect((overview?.getCell('A1').font as Partial<ExcelJS.Font>)?.bold).toBe(true);
		expect((overview?.getCell('A1').fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe(
			'FF111827',
		);
		expect((auditLogs?.getRow(1).getCell(1).font as Partial<ExcelJS.Font>)?.bold).toBe(
			true,
		);
		expect(
			(auditLogs?.getRow(1).getCell(1).fill as ExcelJS.FillPattern)?.fgColor?.argb,
		).toBe('FF1F2937');

		expect(auditLogs?.getRow(2).getCell('C').value).toBe('Document.approved');
		expect(auditLogs?.getRow(2).getCell('E').value).toBe('DBS check');
		expect(verification?.getCell('A1').value).toBe(
			'CareComply Tamper-Evident Export',
		);
		expect(verification?.getCell('B8').value).toBe('manifest-hash');
		expect(verification?.getCell('B9').value).toBe('signature');
	});
});
