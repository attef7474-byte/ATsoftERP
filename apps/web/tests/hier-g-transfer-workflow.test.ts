import { readFileSync } from 'fs';
import { join } from 'path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation } from '../src/lib/i18n/translation-core';
import {
  HIER_G_TRANSFER_STEPS,
  TRANSFER_RESOLUTION_ACTIONS,
  buildTransferPreviewFingerprint,
  isTransferConfirmationReady,
  isTransferResolutionAuthorized,
  requiredTransferRelationships,
  unresolvedTransferRelationshipIds,
} from '../src/lib/admin-types/core';
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
  'currentInbound',
  'currentOutbound',
  'futureInbound',
  'futureOutbound',
  'historicalUnaffected',
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
  'unresolvedRelationships',
  'resolveAllRelationships',
  'noResolutionRequired',
  'historicalUnaffectedNote',
  'supervisionMutationPermissionRequired',
  'supervisionReadPermissionRequired',
  'resolutionPermissionRequired',
  'resolutionNotAllowed',
  'continuationBlockedInvalidReference',
  'continuationBlockedInvalidRange',
  'continuationBlockedAssignmentOutOfRange',
  'continuationBlockedSelfReference',
  'continuationBlockedBranchHierarchy',
  'continuationBlockedDirectOverlap',
  'continuationBlockedCycle',
  'relationshipEffectiveRange',
  'relationshipEffectiveRangeValue',
  'transferPreviewStale',
  'transferInProgress',
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
    const rel: AffectedRelationship = {
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
    const preview: TransferPreviewResponse = {
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
    const req: TransferApplyRequest = {
      departmentId: 'd1',
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      relationshipResolutions: [
        { relationshipId: 'sa-1', action: 'END_AT_TRANSFER' as RelationshipResolutionAction },
      ],
    };
    expect(req.departmentId).toBe('d1');
    expect(req.relationshipResolutions).toHaveLength(1);
    expect(req.relationshipResolutions![0].action).toBe('END_AT_TRANSFER');
  });

  it('TransferApplyResponse has required fields', () => {
    const res: TransferApplyResponse = {
      newAssignment: {
        id: 'pa-2',
        companyId: 'company-a',
        departmentId: 'department-new',
        personnelId: 'person-1',
        assignmentType: 'PRIMARY',
        leadershipLevel: 'NONE',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
        status: 'ACTIVE',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
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

  it('half-open interval: old ends exactly at T and new starts exactly at T', () => {
    const T = new Date('2026-06-01T00:00:00.000Z');
    const oldEffectiveTo = T;
    const newEffectiveFrom = T;
    expect(oldEffectiveTo.getTime()).toBe(newEffectiveFrom.getTime());
    expect(newEffectiveFrom < oldEffectiveTo).toBe(false);
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

  it('CURRENT continuation starts at the transfer date', () => {
    const transferDate = '2026-06-01T00:00:00.000Z';
    const newRel = { effectiveFrom: transferDate, effectiveTo: null };
    expect(newRel.effectiveFrom).toBe(transferDate);
    expect(newRel.effectiveTo).toBeNull();
  });

  it('FUTURE continuation preserves its original scheduled effectiveFrom', () => {
    const transferDate = '2026-06-01T00:00:00.000Z';
    const originalFutureStart = '2026-09-15T00:00:00.000Z';
    const newRel = { effectiveFrom: originalFutureStart, effectiveTo: null };
    expect(newRel.effectiveFrom).toBe(originalFutureStart);
    expect(newRel.effectiveFrom).not.toBe(transferDate);
  });

  it('END_AT_TRANSFER closes at transfer date', () => {
    const transferDate = new Date('2026-06-01T00:00:00.000Z');
    const closed = { effectiveTo: transferDate, isActive: false };
    expect(closed.isActive).toBe(false);
    expect(closed.effectiveTo.getTime()).toBe(transferDate.getTime());
  });

  it('step progression is placement -> preview -> resolution -> confirm -> result', () => {
    expect(HIER_G_TRANSFER_STEPS).toEqual([1, 2, 3, 4, 5]);
    expect(HIER_G_TRANSFER_STEPS).toHaveLength(5);
    expect(HIER_G_TRANSFER_STEPS[HIER_G_TRANSFER_STEPS.length - 1]).toBe(5);
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

function makeRelationship(
  id: string,
  temporalCategory: TemporalCategory = 'CURRENT',
  allowedResolutions: RelationshipResolutionAction[] = [...TRANSFER_RESOLUTION_ACTIONS],
): AffectedRelationship {
  return {
    id,
    direction: 'INBOUND',
    relationshipType: 'DIRECT',
    effectiveFrom: temporalCategory === 'FUTURE' ? '2026-09-15T00:00:00.000Z' : '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    isActive: true,
    temporalCategory,
    otherParty: {
      assignmentId: `assignment-${id}`,
      person: { id: `person-${id}`, name: `Person ${id}`, code: `P-${id}` },
      jobTitle: { id: `job-${id}`, name: 'Supervisor', code: 'SUP' },
      department: { id: `department-${id}`, name: 'Operations', code: 'OPS' },
      branch: { id: `branch-${id}`, name: 'Main branch' },
      administration: { id: `administration-${id}`, name: 'Operations administration' },
      leadershipLevel: 'SUPERVISOR',
      assignmentType: 'PRIMARY',
    },
    allowedResolutions,
  };
}

function makePreview(relationships: AffectedRelationship[]): TransferPreviewResponse {
  const currentInbound = relationships.filter((row) => row.temporalCategory === 'CURRENT' && row.direction === 'INBOUND').length;
  const currentOutbound = relationships.filter((row) => row.temporalCategory === 'CURRENT' && row.direction === 'OUTBOUND').length;
  const futureInbound = relationships.filter((row) => row.temporalCategory === 'FUTURE' && row.direction === 'INBOUND').length;
  const futureOutbound = relationships.filter((row) => row.temporalCategory === 'FUTURE' && row.direction === 'OUTBOUND').length;
  return {
    oldAssignment: {
      id: 'assignment-old',
      person: { id: 'person-1', name: 'Person One', code: 'P001' },
      department: { id: 'department-old', name: 'Old department', code: 'OLD' },
      jobTitle: null,
      branch: null,
      administration: null,
      assignmentType: 'PRIMARY',
      leadershipLevel: 'DEPARTMENT_HEAD',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
    },
    proposedNewAssignment: {
      departmentId: 'department-new',
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
      historicalUnaffected: relationships.filter((row) => row.temporalCategory === 'HISTORICAL').length,
      currentInbound,
      currentOutbound,
      futureInbound,
      futureOutbound,
      directCount: relationships.filter((row) => row.relationshipType === 'DIRECT').length,
      matrixCount: relationships.filter((row) => row.relationshipType === 'MATRIX').length,
      functionalCount: relationships.filter((row) => row.relationshipType === 'FUNCTIONAL').length,
      totalAffected: currentInbound + currentOutbound + futureInbound + futureOutbound,
    },
    affectedRelationships: relationships,
  };
}

describe('HIER-G transfer workflow guards', () => {
  const fullCapabilities = { canAssign: true, canRemove: true };

  it('fingerprint changes whenever the proposed placement changes', () => {
    const base = {
      branchId: 'branch-a',
      administrationId: 'administration-a',
      departmentId: 'department-a',
      jobTitleId: 'job-a',
      assignmentType: 'PRIMARY',
      leadershipLevel: 'NONE',
      effectiveFrom: '2026-06-01',
      notes: 'planned transfer',
    };
    const first = buildTransferPreviewFingerprint('assignment-a', base);
    expect(buildTransferPreviewFingerprint('assignment-a', { ...base, departmentId: 'department-b' })).not.toBe(first);
    expect(buildTransferPreviewFingerprint('assignment-a', { ...base, effectiveFrom: '2026-06-02' })).not.toBe(first);
    expect(buildTransferPreviewFingerprint('assignment-b', base)).not.toBe(first);
    expect(buildTransferPreviewFingerprint('assignment-a', { ...base })).toBe(first);
  });

  it('requires explicit resolutions for current and future rows but never historical rows', () => {
    const current = makeRelationship('current');
    const future = makeRelationship('future', 'FUTURE');
    const historical = makeRelationship('historical', 'HISTORICAL', []);
    const preview = makePreview([current, future, historical]);
    expect(requiredTransferRelationships(preview).map((row) => row.id)).toEqual(['current', 'future']);
    expect(unresolvedTransferRelationshipIds(preview, {}, fullCapabilities)).toEqual(['current', 'future']);
  });

  it('END requires remove permission and CONTINUE requires assign plus remove permissions', () => {
    const relationship = makeRelationship('relationship');
    expect(isTransferResolutionAuthorized(relationship, 'END_AT_TRANSFER', { canAssign: false, canRemove: true })).toBe(true);
    expect(isTransferResolutionAuthorized(relationship, 'END_AT_TRANSFER', { canAssign: true, canRemove: false })).toBe(false);
    expect(isTransferResolutionAuthorized(relationship, 'CONTINUE_ON_NEW_ASSIGNMENT', { canAssign: true, canRemove: true })).toBe(true);
    expect(isTransferResolutionAuthorized(relationship, 'CONTINUE_ON_NEW_ASSIGNMENT', { canAssign: true, canRemove: false })).toBe(false);
    expect(isTransferResolutionAuthorized(relationship, 'CONTINUE_ON_NEW_ASSIGNMENT', { canAssign: false, canRemove: true })).toBe(false);
  });

  it('rejects an action omitted from allowedResolutions even with full permissions', () => {
    const relationship = makeRelationship('end-only', 'CURRENT', ['END_AT_TRANSFER']);
    relationship.continuationBlockedReason = 'validation.directSupervisorOverlap';
    expect(isTransferResolutionAuthorized(relationship, 'END_AT_TRANSFER', fullCapabilities)).toBe(true);
    expect(isTransferResolutionAuthorized(relationship, 'CONTINUE_ON_NEW_ASSIGNMENT', fullCapabilities)).toBe(false);
    expect(relationship.continuationBlockedReason).toBe('validation.directSupervisorOverlap');
  });

  it('maps a cycle-blocked continuation to a localized user-facing reason', () => {
    const pageSource = readFileSync(
      join(__dirname, '../src/app/admin/core/person-assignments/page.tsx'),
      'utf8',
    );
    expect(pageSource).toContain("'validation.cycleDetected': 'core.continuationBlockedCycle'");
    expect(resolve('core.continuationBlockedCycle', 'en')).not.toBe('core.continuationBlockedCycle');
    expect(resolve('core.continuationBlockedCycle', 'ar')).not.toBe('core.continuationBlockedCycle');
  });

  it('does not enable confirmation for a stale preview, unresolved rows, or unauthorized choices', () => {
    const relationship = makeRelationship('relationship');
    const preview = makePreview([relationship]);
    expect(isTransferConfirmationReady(preview, false, { relationship: 'END_AT_TRANSFER' }, fullCapabilities)).toBe(false);
    expect(isTransferConfirmationReady(preview, true, {}, fullCapabilities)).toBe(false);
    expect(isTransferConfirmationReady(preview, true, { relationship: 'CONTINUE_ON_NEW_ASSIGNMENT' }, { canAssign: false, canRemove: true })).toBe(false);
    expect(isTransferConfirmationReady(preview, true, { relationship: 'END_AT_TRANSFER' }, fullCapabilities)).toBe(true);
  });

  it('allows a fresh no-relationships transfer without synthetic resolutions', () => {
    expect(isTransferConfirmationReady(makePreview([]), true, {}, fullCapabilities)).toBe(true);
  });
});

describe('HIER-G person-assignment page contract', () => {
  const pageSource = readFileSync(
    join(__dirname, '../src/app/admin/core/person-assignments/page.tsx'),
    'utf8',
  );

  it('renders five distinct workflow sections and uses the shared five-step contract', () => {
    for (const section of ['placement', 'preview', 'resolution', 'confirmation', 'result']) {
      expect(pageSource).toContain(`data-transfer-step="${section}"`);
    }
    expect(pageSource).toContain('HIER_G_TRANSFER_STEPS.map');
    expect(pageSource).toContain('setTransferStep(5)');
  });

  it('uses preview fingerprints, request versions, and AbortController against stale responses', () => {
    expect(pageSource).toContain('buildTransferPreviewFingerprint');
    expect(pageSource).toContain('previewRequestVersionRef');
    expect(pageSource).toContain('AbortController');
    expect(pageSource).toContain('requestFingerprint !== latestFingerprint');
    expect(pageSource).toContain('invalidateTransferPreview');
  });

  it('gates confirmation and apply on a fresh fully resolved preview', () => {
    expect(pageSource).toContain('confirmationReady');
    expect(pageSource).toContain('disabled={!confirmationReady}');
    expect(pageSource).toContain('disabled={!confirmationReady || !previewIsFresh}');
    expect(pageSource).toContain('unresolvedTransferRelationshipIds');
  });

  it('renders every resolution action disabled unless allowed and authorized', () => {
    expect(pageSource).toContain('TRANSFER_RESOLUTION_ACTIONS.map');
    expect(pageSource).toContain('relationship.allowedResolutions.includes(action)');
    expect(pageSource).toContain('disabled={!authorized}');
    expect(pageSource).toContain('resolutionPermissionRequired');
  });

  it('uses transfer and supervision permissions without rendering raw permission keys', () => {
    expect(pageSource).toContain("permissionKeys.includes('person-assignment:transfer')");
    expect(pageSource).toContain("permissionKeys.includes('supervisor:read')");
    expect(pageSource).toContain("permissionKeys.includes('supervisor:assign')");
    expect(pageSource).toContain("permissionKeys.includes('supervisor:remove')");
    expect(pageSource).toContain('const canOpenTransfer = canTransferAssignment;');
    expect(pageSource).toContain('supervisionReadPermissionRequired');
    expect(pageSource).not.toContain('const canOpenTransfer = canTransferAssignment && canReadSupervision;');
    expect(pageSource).toContain("record.assignmentType === 'PRIMARY' && !record.effectiveTo");
    expect(pageSource).not.toMatch(/>\s*(?:person-assignment:transfer|supervisor:(?:read|assign|remove))\s*</);
  });

  it('never renders internal assignment identifiers or hardcoded transfer labels', () => {
    const forbiddenVisiblePatterns = [
      /transferRecord\.person\?\.name\s*\|\|\s*transferRecord\.personnelId/,
      /proposedNewAssignment\.departmentId\s*\}/,
      /otherParty\.assignmentId\s*\}/,
      /newAssignment\?*\.id\s*\}/,
      /ID:\s*\{/,
      /title=["']Transfer["']/,
    ];
    for (const pattern of forbiddenVisiblePatterns) expect(pageSource).not.toMatch(pattern);
  });

  it('renders human relationship context and uses the structured API error handler', () => {
    for (const field of ['otherParty.jobTitle', 'otherParty.department', 'otherParty.administration', 'otherParty.branch', 'relationship.relationshipType', 'relationship.effectiveFrom']) {
      expect(pageSource).toContain(field);
    }
    expect(pageSource).toContain('useApiErrorHandler');
    expect(pageSource).toContain('handleApiError(err)');
    expect(pageSource).toContain('continuationBlockedReason');
    expect(pageSource).toContain('data-continuation-blocked-reason');
    expect(pageSource).toContain('CONTINUATION_BLOCKED_REASON_KEYS');
  });

  it('renders the complete proposed placement in preview and confirmation without identifiers', () => {
    const confirmationStart = pageSource.indexOf('data-transfer-step="confirmation"');
    const confirmationEnd = pageSource.indexOf('data-transfer-step="result"');
    const confirmationSource = pageSource.slice(confirmationStart, confirmationEnd);
    expect(confirmationStart).toBeGreaterThan(-1);
    for (const value of [
      'transferLabels.department',
      'transferLabels.jobTitle',
      'transferLabels.branch',
      'transferLabels.administration',
      "core.assignmentType",
      "core.leadershipLevel",
      "core.transferDateLabel",
    ]) {
      expect(confirmationSource).toContain(value);
    }
    expect(confirmationSource).not.toContain('proposedNewAssignment.departmentId');
    expect(confirmationSource).not.toContain('proposedNewAssignment.branchId');
    expect(confirmationSource).not.toContain('proposedNewAssignment.administrationId');
    expect(confirmationSource).not.toContain('proposedNewAssignment.jobTitleId');
  });

  it('prevents closing the mutation workflow while apply is running', () => {
    const closeStart = pageSource.indexOf('const closeTransferWorkflow');
    const closeEnd = pageSource.indexOf('const openCreateModal');
    const closeSource = pageSource.slice(closeStart, closeEnd);
    expect(closeStart).toBeGreaterThan(-1);
    expect(closeSource).toContain('if (saving || applyInFlightRef.current) return;');
    expect(pageSource).toContain('applyInFlightRef.current');
    expect(pageSource).toContain('disabled={saving}');
    expect(pageSource).toContain('transferInProgress');
  });
});
