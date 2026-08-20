import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';
import type {
  EligibilityCode,
  TeamMember,
  TeamResponse,
  CandidateRow,
  CandidateResponse,
  PreviewRow,
  PreviewResponse,
  BulkApplyResponse,
} from '../src/lib/admin-types/core';

function resolve(key: string, locale: 'ar' | 'en', params?: Record<string, string | number>): string {
  const data = locale === 'ar' ? (ar as any) : (en as any);
  return resolveTranslation(data, locale, key, undefined, params);
}

const HIER_C_EN_KEYS = [
  'core.teamManagement',
  'core.currentRelationships',
  'core.selectLeader',
  'core.leaderSummary',
  'core.currentTeam',
  'core.currentTeamCount',
  'core.availablePeople',
  'core.candidates',
  'core.noTeamMembers',
  'core.noCandidates',
  'core.noLeaderSelected',
  'core.selectEmployees',
  'core.selectedCount',
  'core.selectEligiblePage',
  'core.clearSelection',
  'core.previewSelected',
  'core.addToTeam',
  'core.previewSummary',
  'core.requested',
  'core.eligible',
  'core.conflicts',
  'core.invalid',
  'core.alreadyAssigned',
  'core.previewResults',
  'core.result',
  'core.reason',
  'core.currentSupervisorLabel',
  'core.applyNow',
  'core.backToSelection',
  'core.applySuccess',
  'core.applyFailed',
  'core.stalePreview',
  'core.effectiveDateRange',
  'core.notSpecified',
];

const ELIGIBILITY_CODES: EligibilityCode[] = [
  'ELIGIBLE',
  'SELF',
  'OUTSIDE_ALLOWED_BRANCH_SCOPE',
  'ALREADY_ON_THIS_TEAM',
  'HAS_OTHER_DIRECT_SUPERVISOR',
  'DATE_WINDOW_CONFLICT',
  'DIRECT_OVERLAP',
  'CYCLE_DETECTED',
  'MISSING',
];

describe('HIER-C TypeScript types exist in admin-types/core.ts', () => {
  it('EligibilityCode is a union of exactly 9 strings', () => {
    const validCodes: EligibilityCode[] = [
      'ELIGIBLE', 'SELF', 'OUTSIDE_ALLOWED_BRANCH_SCOPE',
      'ALREADY_ON_THIS_TEAM', 'HAS_OTHER_DIRECT_SUPERVISOR',
      'DATE_WINDOW_CONFLICT', 'DIRECT_OVERLAP', 'CYCLE_DETECTED', 'MISSING',
    ];
    expect(validCodes).toHaveLength(9);
  });

  it('TeamMember has required fields', () => {
    const member: TeamMember = {
      assignmentId: 'cuid123',
      person: { id: 'p1', name: 'Ahmed', code: 'EMP-001' },
      department: null,
      jobTitle: null,
      branch: null,
      administration: null,
      assignmentType: 'PRIMARY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      status: 'ACTIVE',
    };
    expect(member.assignmentId).toBeTruthy();
    expect(member.person.name).toBeTruthy();
    expect(member.status).toBe('ACTIVE');
  });

  it('TeamResponse has supervisor, team array, and teamCount', () => {
    const response: TeamResponse = {
      supervisor: { id: 's1', name: 'Supervisor', code: 'SUP-001', department: null, jobTitle: null, branch: null },
      team: [],
      teamCount: 0,
      asOf: '2026-01-01T00:00:00.000Z',
    };
    expect(response.supervisor.name).toBeTruthy();
    expect(response.team).toEqual([]);
    expect(response.teamCount).toBe(0);
  });

  it('CandidateRow has eligibility fields', () => {
    const candidate: CandidateRow = {
      id: 'c1',
      personnelId: 'p1',
      branchId: null,
      departmentId: null,
      jobTitleId: null,
      administrationId: null,
      assignmentType: 'PRIMARY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      person: { id: 'p1', name: 'Ali', code: 'EMP-002' },
      department: null,
      jobTitle: null,
      branch: null,
      administration: null,
      status: 'ELIGIBLE',
      reasonCode: 'ELIGIBLE',
      currentDirectSupervisor: null,
    };
    expect(candidate.status).toBe('ELIGIBLE');
    expect(candidate.reasonCode).toBe('ELIGIBLE');
  });

  it('CandidateResponse has data array, meta, and supervisor', () => {
    const response: CandidateResponse = {
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      supervisor: { assignmentId: 's1', person: { id: 'p1', name: 'S', code: 'SUP-001' }, branch: null },
    };
    expect(response.data).toEqual([]);
    expect(response.meta.total).toBe(0);
  });

  it('PreviewRow has eligibility status and reasonCode', () => {
    const row: PreviewRow = {
      assignmentId: 'a1',
      person: { id: 'p1', name: 'Ali', code: 'EMP-002' },
      department: null,
      jobTitle: null,
      branch: null,
      assignmentType: 'PRIMARY',
      status: 'ELIGIBLE',
      reasonCode: 'ELIGIBLE',
    };
    expect(row.status).toBe('ELIGIBLE');
  });

  it('PreviewResponse has summary and rows', () => {
    const response: PreviewResponse = {
      summary: { requested: 5, eligible: 3, alreadyAssigned: 1, conflicts: 1, invalid: 0 },
      rows: [],
    };
    expect(response.summary.requested).toBe(5);
    expect(response.summary.eligible).toBe(3);
  });

  it('BulkApplyResponse has created array and count', () => {
    const response: BulkApplyResponse = {
      created: [],
      count: 0,
    };
    expect(response.count).toBe(0);
  });
});

describe('HIER-C English i18n keys resolve', () => {
  for (const key of HIER_C_EN_KEYS) {
    it(`EN: ${key} resolves to a non-empty string`, () => {
      const result = resolve(key, 'en');
      expect(result).not.toBe(TRANSLATION_FALLBACKS['en']);
      expect(result.length).toBeGreaterThan(0);
    });
  }
});

describe('HIER-C Arabic i18n keys resolve', () => {
  for (const key of HIER_C_EN_KEYS) {
    it(`AR: ${key} resolves to a non-empty string`, () => {
      const result = resolve(key, 'ar');
      expect(result).not.toBe(TRANSLATION_FALLBACKS['ar']);
      expect(result.length).toBeGreaterThan(0);
    });
  }
});

describe('HIER-C eligibility status translations', () => {
  for (const code of ELIGIBILITY_CODES) {
    it(`EN: core.eligibilityStatuses.${code} resolves`, () => {
      const result = resolve(`core.eligibilityStatuses.${code}`, 'en');
      expect(result).not.toBe(TRANSLATION_FALLBACKS['en']);
      expect(result.length).toBeGreaterThan(0);
    });

    it(`AR: core.eligibilityStatuses.${code} resolves`, () => {
      const result = resolve(`core.eligibilityStatuses.${code}`, 'ar');
      expect(result).not.toBe(TRANSLATION_FALLBACKS['ar']);
      expect(result.length).toBeGreaterThan(0);
    });
  }
});

describe('HIER-C EN/AR key synchronization', () => {
  it('core.eligibilityStatuses keys match between EN and AR', () => {
    const enCore = (en as any).core.eligibilityStatuses;
    const arCore = (ar as any).core.eligibilityStatuses;
    expect(Object.keys(enCore).sort()).toEqual(Object.keys(arCore).sort());
  });

  it('HIER-C UI keys exist in both EN and AR', () => {
    const enCore = (en as any).core;
    const arCore = (ar as any).core;
    const hierCKeys = [
      'teamManagement', 'currentRelationships', 'selectLeader', 'leaderSummary',
      'currentTeam', 'currentTeamCount', 'availablePeople', 'candidates',
      'noTeamMembers', 'noCandidates', 'noLeaderSelected', 'selectEmployees',
      'selectedCount', 'selectEligiblePage', 'clearSelection', 'previewSelected',
      'addToTeam', 'previewSummary', 'requested', 'eligible', 'conflicts',
      'invalid', 'alreadyAssigned', 'previewResults', 'result', 'reason',
      'currentSupervisorLabel', 'applyNow', 'backToSelection', 'applySuccess',
      'applyFailed', 'stalePreview', 'effectiveDateRange', 'notSpecified',
    ];
    for (const key of hierCKeys) {
      expect(enCore[key]).toBeDefined();
      expect(typeof enCore[key]).toBe('string');
      expect(arCore[key]).toBeDefined();
      expect(typeof arCore[key]).toBe('string');
    }
  });
});

describe('HIER-C i18n interpolation contracts', () => {
  it('selectedCount interpolates {count} in English', () => {
    const result = resolve('core.selectedCount', 'en', { count: 7 });
    expect(result).toBe('7 employees selected');
  });

  it('selectedCount interpolates {count} in Arabic', () => {
    const result = resolve('core.selectedCount', 'ar', { count: 7 });
    expect(result).toContain('7');
    expect(result).not.toBe(TRANSLATION_FALLBACKS['ar']);
  });

  it('applySuccess interpolates {count} in English', () => {
    const result = resolve('core.applySuccess', 'en', { count: 3 });
    expect(result).toBe('3 employees added to the team successfully.');
  });

  it('applySuccess interpolates {count} in Arabic', () => {
    const result = resolve('core.applySuccess', 'ar', { count: 3 });
    expect(result).toContain('3');
    expect(result).not.toBe(TRANSLATION_FALLBACKS['ar']);
  });
});

describe('HIER-C English labels are not Arabic and vice versa', () => {
  it('EN teamManagement is English text', () => {
    const result = resolve('core.teamManagement', 'en');
    expect(result).toBe('Team Management');
  });

  it('AR teamManagement is Arabic text', () => {
    const result = resolve('core.teamManagement', 'ar');
    expect(result).not.toBe('Team Management');
    expect(result).not.toBe(TRANSLATION_FALLBACKS['ar']);
  });
});

describe('HIER-C page source code safety — no raw CUID fallbacks', () => {
  let pageSource: string;

  beforeAll(async () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.resolve(__dirname, '../src/app/admin/core/supervisor-assignments/page.tsx');
    pageSource = fs.readFileSync(pagePath, 'utf8');
  });

  it('page file exists and is readable', () => {
    expect(pageSource).toBeDefined();
    expect(pageSource.length).toBeGreaterThan(0);
  });

  it('no raw CUID used as user-visible label fallback', () => {
    const fallbackPatterns = [
      /\|\|\s*record\.id/,
      /\|\|\s*assignmentId/,
      /\|\|\s*supervisorAssignmentId/,
      /\|\|\s*personId/,
    ];
    for (const pattern of fallbackPatterns) {
      expect(pageSource).not.toMatch(pattern);
    }
  });

  it('no hardcoded English labels (Subordinate/Supervisor/Current Team)', () => {
    expect(pageSource).not.toMatch(/\(Subordinate\)/);
    expect(pageSource).not.toMatch(/\(Supervisor\)/);
    expect(pageSource).not.toMatch(/\(Current Team\)/);
  });

  it('no hardcoded http://localhost:4000', () => {
    expect(pageSource).not.toContain('http://localhost:4000');
  });

  it('no double /api/v1/v1/ path', () => {
    expect(pageSource).not.toContain('/api/v1/v1/');
  });

  it('uses t() for all user-facing text (no raw Arabic)', () => {
    const arabicPattern = /[\u0600-\u06FF]/;
    const lines = pageSource.split('\n');
    const rawArabicLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (arabicPattern.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        rawArabicLines.push(`Line ${i + 1}: ${line.trim()}`);
      }
    }
    expect(rawArabicLines).toEqual([]);
  });

  it('no raw hardcoded English UI text outside comments and class names', () => {
    const lines = pageSource.split('\n');
    const hardcodePatterns = [
      /^\s*\}\s*['"]Team Management['"]/,
      /^\s*\}\s*['"]Current Team['"]/,
      /^\s*\}\s*['"]Select Leader['"]/,
      /^\s*\}\s*['"]Add to Team['"]/,
    ];
    const violations: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      for (const p of hardcodePatterns) {
        if (p.test(lines[i])) {
          violations.push(`Line ${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('isEligible function only admits ELIGIBLE code', () => {
    const match = pageSource.match(/const isEligible\s*=\s*\(status:\s*EligibilityCode\)\s*=>\s*(.*?);/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain("status === 'ELIGIBLE'");
  });

  it('handleApply blocks when conflicts or invalid exist', () => {
    expect(pageSource).toContain('previewData.summary.conflicts > 0');
    expect(pageSource).toContain('previewData.summary.invalid > 0');
  });

  it('candidate request uses AbortController for race-condition safety', () => {
    expect(pageSource).toContain('AbortController');
    expect(pageSource).toContain('candidateAbortRef');
    expect(pageSource).toContain('signal');
  });

  it('preview is invalidated when selection changes', () => {
    const toggleSelect = pageSource.match(/const toggleSelect = \(id: string\) => \{([\s\S]*?)\n  \};/);
    expect(toggleSelect).toBeTruthy();
    expect(toggleSelect![1]).toContain('setPreviewData(null)');
    expect(toggleSelect![1]).toContain('setShowPreview(false)');
  });

  it('leader select clears selection and preview', () => {
    const handleLeaderSelect = pageSource.match(/const handleLeaderSelect = useCallback\(\(item: any\) => \{([\s\S]*?)\}, \[loadTeam, loadCandidates\]\);/);
    expect(handleLeaderSelect).toBeTruthy();
    expect(handleLeaderSelect![1]).toContain('setSelectedIds(new Set())');
    expect(handleLeaderSelect![1]).toContain('setPreviewData(null)');
    expect(handleLeaderSelect![1]).toContain('setShowPreview(false)');
  });

  it('toggleSelectAllPage only targets eligible candidates', () => {
    const match = pageSource.match(/const toggleSelectAllPage = \(\) => \{([\s\S]*?)\n  \};/);
    expect(match).toBeTruthy();
    expect(match![1]).toContain('isEligible(c.status)');
  });

  it('bulk apply request includes required fields', () => {
    expect(pageSource).toContain('supervisorAssignmentId: leaderInfo.assignmentId');
    expect(pageSource).toContain('effectiveFrom');
    expect(pageSource).toContain('assignmentIds: Array.from(selectedIds)');
  });

  it('no [object Object] or undefined as visible fallback in render logic', () => {
    const renderLines = pageSource.split('\n');
    const issues: string[] = [];
    for (let i = 0; i < renderLines.length; i++) {
      const line = renderLines[i];
      if (line.includes('`${') || line.includes("'${")) {
        if (line.includes('object Object')) {
          issues.push(`Line ${i + 1}: object Object literal`);
        }
      }
    }
    expect(issues).toEqual([]);
  });
});
