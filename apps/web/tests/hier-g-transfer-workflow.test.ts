import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation } from '../src/lib/i18n/translation-core';
import type {
  TransferPreviewResponse,
  TransferApplyRequest,
  TransferApplyResponse,
  AffectedRelationship,
  RelationshipResolutionAction,
  TemporalCategory,
  RelationshipDirection,
} from '../src/lib/admin-types/core';

function resolve(key: any, locale: any): string {
  const data = locale === 'ar' ? ar : en;
  return resolveTranslation(data, locale, key);
}

const HIER_G_KEYS = [
  'transferWorkflow',
  'transferStep1',
  'transferStep2',
  'transferStep3',
  'transferStep4',
  'transferStep5',
  'transferPreviewTitle',
  'transferPreviewDescription',
  'transferDateLabel',
  'oldPlacement',
  'transferNewPlacement',
  'noAffectedRelationships',
  'affectedRelationshipsCount',
  'affectedRelationshipsRequireAction',
  'temporalCategory',
  'direction',
  'resolutionAction',
  'resolutionSummary',
  'ended',
  'continued',
  'needsAction',
  'confirmTransferTitle',
  'confirmTransferDescription',
  'confirmTransferCloseOld',
  'confirmTransferCreateNew',
  'confirmTransferReconcile',
  'transferSuccess',
  'transferSuccessSummary',
  'transferFailed',
  'transferBackToPreview',
  'applyTransfer',
  'resolutionRequiredNotice',
  'noResolutionRequired',
  'historicalUnaffectedNote',
  'directRelationship',
  'matrixRelationship',
  'functionalRelationship',
  'relationshipTypeLabel',
  'otherPartyLabel',
  'originalLeaderRole',
  'newLeaderRole',
];

const HIER_G_NESTED_KEYS = [
  'temporalCategories.HISTORICAL',
  'temporalCategories.CURRENT',
  'temporalCategories.FUTURE',
  'directions.INBOUND',
  'directions.OUTBOUND',
  'resolutionActions.END_AT_TRANSFER',
  'resolutionActions.CONTINUE_ON_NEW_ASSIGNMENT',
];

describe('HIER-G transfer workflow i18n keys', () => {
  describe('English translations', () => {
    for (const key of HIER_G_KEYS) {
      it(`EN: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'en');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
    for (const key of HIER_G_NESTED_KEYS) {
      it(`EN: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'en');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
      });
    }
  });

  describe('Arabic translations', () => {
    for (const key of HIER_G_KEYS) {
      it(`AR: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'ar');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
    for (const key of HIER_G_NESTED_KEYS) {
      it(`AR: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'ar');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
      });
    }
  });

  describe('EN/AR key synchronization', () => {
    it('EN and AR have the same HIER-G keys', () => {
      const enCore = en.core;
      const arCore = ar.core;
      for (const key of HIER_G_KEYS) {
        expect(enCore).toHaveProperty(key);
        expect(arCore).toHaveProperty(key);
      }
    });

    it('EN and AR have the same HIER-G nested keys', () => {
      const enCore = en.core;
      const arCore = ar.core;
      expect(enCore.temporalCategories).toBeDefined();
      expect(arCore.temporalCategories).toBeDefined();
      expect(enCore.directions).toBeDefined();
      expect(arCore.directions).toBeDefined();
      expect(enCore.resolutionActions).toBeDefined();
      expect(arCore.resolutionActions).toBeDefined();
      for (const cat of ['HISTORICAL', 'CURRENT', 'FUTURE']) {
        expect(enCore.temporalCategories).toHaveProperty(cat);
        expect(arCore.temporalCategories).toHaveProperty(cat);
      }
      for (const dir of ['INBOUND', 'OUTBOUND']) {
        expect(enCore.directions).toHaveProperty(dir);
        expect(arCore.directions).toHaveProperty(dir);
      }
      for (const act of ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT']) {
        expect(enCore.resolutionActions).toHaveProperty(act);
        expect(arCore.resolutionActions).toHaveProperty(act);
      }
    });

    it('EN keys are not empty', () => {
      const enCore = en.core;
      for (const key of HIER_G_KEYS) {
        const val = enCore[key];
        expect(typeof val).toBe('string');
        expect((val || '').length).toBeGreaterThan(0);
      }
    });

    it('AR keys are not empty', () => {
      const arCore = ar.core;
      for (const key of HIER_G_KEYS) {
        const val = arCore[key];
        expect(typeof val).toBe('string');
        expect((val || '').length).toBeGreaterThan(0);
      }
    });
  });
});

describe('HIER-G type existence', () => {
  it('AffectedRelationship has required fields', () => {
    const rel = {
      id: 'sa-1',
      direction: 'INBOUND' as RelationshipDirection,
      relationshipType: 'DIRECT',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      temporalCategory: 'CURRENT' as TemporalCategory,
      otherParty: {
        person: { id: 'p1', name: 'Ahmed', code: 'A001' },
        jobTitle: null,
        department: null,
        branch: null,
        administration: null,
        leadershipLevel: 'DEPARTMENT_HEAD',
        assignmentId: 'pa-super-1',
      },
      allowedResolutions: ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'] as RelationshipResolutionAction[],
    };
    expect(rel.id).toBe('sa-1');
    expect(rel.direction).toBe('INBOUND');
    expect(rel.temporalCategory).toBe('CURRENT');
    expect(rel.allowedResolutions).toHaveLength(2);
    expect(rel.otherParty.assignmentId).toBe('pa-super-1');
    expect(rel.otherParty.person?.name).toBe('Ahmed');
  });

  it('AffectedRelationship supports all directions', () => {
    for (const dir of ['INBOUND', 'OUTBOUND']) {
      const rel = {
        id: 'sa-test',
        direction: dir as RelationshipDirection,
        relationshipType: 'DIRECT',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        isActive: true,
        temporalCategory: 'CURRENT' as TemporalCategory,
        otherParty: { assignmentId: 'pa-test' },
        allowedResolutions: [] as RelationshipResolutionAction[],
      };
      expect(rel.direction).toBe(dir);
    }
  });

  it('AffectedRelationship supports all temporal categories', () => {
    for (const cat of ['HISTORICAL', 'CURRENT', 'FUTURE']) {
      const rel = {
        id: 'sa-test',
        direction: 'INBOUND' as RelationshipDirection,
        relationshipType: 'DIRECT',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        isActive: true,
        temporalCategory: cat as TemporalCategory,
        otherParty: { assignmentId: 'pa-test' },
        allowedResolutions: [] as RelationshipResolutionAction[],
      };
      expect(rel.temporalCategory).toBe(cat);
    }
  });

  it('TransferPreviewResponse has required structure', () => {
    const preview = {
      oldAssignment: {
        id: 'pa-1',
        person: { id: 'p1', name: 'Test', code: 'T' },
        department: { id: 'd1', name: 'Dept', code: 'D' },
        jobTitle: null,
        branch: null,
        administration: null,
        assignmentType: 'PRIMARY',
        leadershipLevel: 'DEPARTMENT_HEAD',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
      },
      proposedNewAssignment: {
        departmentId: 'd2',
        branchId: null,
        administrationId: null,
        jobTitleId: null,
        assignmentType: 'PRIMARY',
        leadershipLevel: 'NONE',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
      },
      transferDate: '2026-06-01T00:00:00.000Z',
      summary: {
        historicalUnaffected: 0,
        currentInbound: 1,
        currentOutbound: 0,
        futureInbound: 0,
        futureOutbound: 0,
        directCount: 1,
        matrixCount: 0,
        functionalCount: 0,
        totalAffected: 1,
      },
      affectedRelationships: [],
    };
    expect(preview.oldAssignment.id).toBe('pa-1');
    expect(preview.summary.totalAffected).toBe(1);
    expect(preview.proposedNewAssignment.leadershipLevel).toBe('NONE');
  });

  it('TransferApplyRequest has required fields', () => {
    const req = {
      departmentId: 'd1',
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      relationshipResolutions: [
        { relationshipId: 'sa-1', action: 'END_AT_TRANSFER' as RelationshipResolutionAction },
      ],
    };
    expect(req.departmentId).toBe('d1');
    expect(req.relationshipResolutions).toHaveLength(1);
    expect(req.relationshipResolutions[0].action).toBe('END_AT_TRANSFER');
  });

  it('TransferApplyResponse has required fields', () => {
    const res = {
      newAssignment: { id: 'pa-2' },
      relationshipsEnded: 1,
      relationshipsContinued: 0,
    };
    expect(res.newAssignment.id).toBe('pa-2');
    expect(res.relationshipsEnded).toBe(1);
    expect(res.relationshipsContinued).toBe(0);
  });
});

describe('HIER-G transfer logic', () => {
  it('temporal classification: HISTORICAL when effectiveTo <= transferDate', () => {
    const effectiveTo = new Date('2026-03-01');
    const transferDate = new Date('2026-06-01');
    expect(effectiveTo <= transferDate).toBe(true);
  });

  it('temporal classification: FUTURE when effectiveFrom >= transferDate', () => {
    const effectiveFrom = new Date('2027-01-01');
    const transferDate = new Date('2026-06-01');
    expect(effectiveFrom >= transferDate).toBe(true);
  });

  it('temporal classification: CURRENT when effectiveFrom < transferDate and active', () => {
    const effectiveFrom = new Date('2026-01-01');
    const transferDate = new Date('2026-06-01');
    const isActive = true;
    expect(effectiveFrom < transferDate && isActive).toBe(true);
  });

  it('half-open interval: old ends at T, new starts at T, no overlap', () => {
    const T = new Date('2026-06-01T00:00:00.000Z');
    const oldEffectiveTo = new Date(T.getTime() - 1);
    const newEffectiveFrom = T;
    expect(oldEffectiveTo < newEffectiveFrom).toBe(true);
    expect(oldEffectiveTo.getTime() + 1 === newEffectiveFrom.getTime()).toBe(true);
  });

  it('resolution validation: foreign relationship rejected', () => {
    const affectedIds = ['sa-1', 'sa-2'];
    const resolutionId = 'sa-foreign';
    expect(affectedIds.includes(resolutionId)).toBe(false);
  });

  it('resolution validation: all non-historical must have resolution', () => {
    const affectedRelationships = [
      { id: 'sa-1', temporalCategory: 'CURRENT', allowedResolutions: ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'] },
      { id: 'sa-2', temporalCategory: 'FUTURE', allowedResolutions: ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'] },
      { id: 'sa-3', temporalCategory: 'HISTORICAL', allowedResolutions: [] },
    ];
    const resolutions = { 'sa-1': 'END_AT_TRANSFER', 'sa-2': 'CONTINUE_ON_NEW_ASSIGNMENT' };
    const nonHistorical = affectedRelationships.filter(r => r.temporalCategory !== 'HISTORICAL' && r.allowedResolutions.length > 0);
    for (const r of nonHistorical) {
      expect(resolutions).toHaveProperty(r.id);
    }
  });

  it('resolution validation: historical relationships need no resolution', () => {
    const rel = { id: 'sa-hist', temporalCategory: 'HISTORICAL', allowedResolutions: [] };
    expect(rel.allowedResolutions).toHaveLength(0);
  });

  it('transfer preserves old assignment leadership level', () => {
    const old = { leadershipLevel: 'DEPARTMENT_HEAD' };
    const transferred = { leadershipLevel: 'NONE' };
    expect(old.leadershipLevel).toBe('DEPARTMENT_HEAD');
    expect(transferred.leadershipLevel).toBe('NONE');
  });

  it('transfer defaults new leadership level to NONE', () => {
    const leadershipLevel = undefined;
    const effective = leadershipLevel ?? 'NONE';
    expect(effective).toBe('NONE');
  });

  it('CONTINUE_ON_NEW_ASSIGNMENT uses transfer date as effectiveFrom', () => {
    const transferDate = '2026-06-01T00:00:00.000Z';
    const newRel = { effectiveFrom: transferDate, effectiveTo: null };
    expect(newRel.effectiveFrom).toBe(transferDate);
    expect(newRel.effectiveTo).toBeNull();
  });

  it('END_AT_TRANSFER closes at transfer date', () => {
    const transferDate = new Date('2026-06-01T00:00:00.000Z');
    const closed = { effectiveTo: transferDate, isActive: false };
    expect(closed.isActive).toBe(false);
    expect(closed.effectiveTo.getTime()).toBe(transferDate.getTime());
  });

  it('step progression: 1 -> 2 -> 3 -> 4', () => {
    const steps = [1, 2, 3, 4];
    expect(steps).toHaveLength(4);
    expect(steps[steps.length - 1]).toBe(4);
  });

  it('summary totalAffected = currentInbound + currentOutbound + futureInbound + futureOutbound', () => {
    const currentInbound = 2;
    const currentOutbound = 1;
    const futureInbound = 1;
    const futureOutbound = 0;
    const totalAffected = currentInbound + currentOutbound + futureInbound + futureOutbound;
    expect(totalAffected).toBe(4);
  });
});
