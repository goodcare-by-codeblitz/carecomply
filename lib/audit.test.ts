import { describe, expect, it } from 'vitest';
import { getAuditDefaults } from './audit';

describe('audit defaults', () => {
	it('cover all five CQC key questions', () => {
		const representativeActions = [
			'document.approved',
			'reference.approved',
			'carer.updated',
			'reference.responded',
			'audit.exported',
		];

		const questions = new Set(
			representativeActions.map(
				(action) => getAuditDefaults(action).cqcKeyQuestion,
			),
		);

		expect([...questions].sort()).toEqual(
			['caring', 'effective', 'responsive', 'safe', 'well_led'].sort(),
		);
	});

	it('maps reference requirement settings to effective', () => {
		expect(
			getAuditDefaults('settings.updated', {
				details: { setting_area: 'reference_requirements' },
			}).cqcKeyQuestion,
		).toBe('effective');
	});

	it('keeps ordinary organization settings well-led', () => {
		expect(
			getAuditDefaults('settings.updated', {
				details: { setting_area: 'profile' },
			}).cqcKeyQuestion,
		).toBe('well_led');
	});

	it('uses onboarding category for onboarding document uploads', () => {
		const defaults = getAuditDefaults('document.uploaded', {
			source: 'onboarding',
		});

		expect(defaults.category).toBe('onboarding');
		expect(defaults.cqcKeyQuestion).toBe('safe');
	});

	it('keeps dashboard document uploads in document category', () => {
		expect(getAuditDefaults('document.uploaded').category).toBe('documents');
	});

	it('uses onboarding category for onboarding profile updates', () => {
		const defaults = getAuditDefaults('carer.updated', {
			source: 'onboarding',
		});

		expect(defaults.category).toBe('onboarding');
		expect(defaults.cqcKeyQuestion).toBe('caring');
	});

	it('maps training audit actions to effective', () => {
		expect(getAuditDefaults('training.completed').category).toBe('training');
		expect(getAuditDefaults('training.completed').cqcKeyQuestion).toBe(
			'effective',
		);
		expect(
			getAuditDefaults('training_requirement.created').cqcKeyQuestion,
		).toBe('effective');
	});
});
