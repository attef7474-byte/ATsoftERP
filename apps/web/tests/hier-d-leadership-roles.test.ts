import fs from 'fs';
import path from 'path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation } from '../src/lib/i18n/translation-core';

function resolve(key: string, locale: 'ar' | 'en'): string {
  const data = locale === 'ar' ? (ar as any) : (en as any);
  return resolveTranslation(data, locale, key);
}

const LEADERSHIP_LEVELS = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];

const LEADERSHIP_EN_KEYS = [
  'core.leadershipLevel',
  'core.leadershipHelp.TEAM_LEAD',
  'core.leadershipHelp.SUPERVISOR',
  'core.leadershipHelp.DEPARTMENT_HEAD',
  'core.leadershipHelp.ADMINISTRATION_MANAGER',
  'core.leadershipDepartmentRequired',
  'core.leadershipAdminRequired',
  'core.primaryAdminManagerOverlap',
  'core.primaryDepartmentHeadOverlap',
];

const LEADERSHIP_AR_KEYS = [
  'core.leadershipLevel',
  'core.leadershipHelp.TEAM_LEAD',
  'core.leadershipHelp.SUPERVISOR',
  'core.leadershipHelp.DEPARTMENT_HEAD',
  'core.leadershipHelp.ADMINISTRATION_MANAGER',
  'core.leadershipDepartmentRequired',
  'core.leadershipAdminRequired',
  'core.primaryAdminManagerOverlap',
  'core.primaryDepartmentHeadOverlap',
];

describe('HIER-D English leadership level translations', () => {
  for (const level of LEADERSHIP_LEVELS) {
    it(`EN: core.leadershipLevels.${level} resolves`, () => {
      expect(resolve(`core.leadershipLevels.${level}`, 'en')).toBeTruthy();
    });
  }
});

describe('HIER-D Arabic leadership level translations', () => {
  for (const level of LEADERSHIP_LEVELS) {
    it(`AR: core.leadershipLevels.${level} resolves`, () => {
      expect(resolve(`core.leadershipLevels.${level}`, 'ar')).toBeTruthy();
    });
  }
});

describe('HIER-D English leadership help and error keys', () => {
  for (const key of LEADERSHIP_EN_KEYS) {
    it(`EN: ${key} resolves to a non-empty string`, () => {
      expect(resolve(key, 'en')).toBeTruthy();
    });
  }
});

describe('HIER-D Arabic leadership help and error keys', () => {
  for (const key of LEADERSHIP_AR_KEYS) {
    it(`AR: ${key} resolves to a non-empty string`, () => {
      expect(resolve(key, 'ar')).toBeTruthy();
    });
  }
});

describe('HIER-D EN/AR leadership key synchronization', () => {
  it('core.leadershipLevels keys match between EN and AR', () => {
    const enLevels = Object.keys((en as any).core?.leadershipLevels || {});
    const arLevels = Object.keys((ar as any).core?.leadershipLevels || {});
    expect(enLevels.sort()).toEqual(arLevels.sort());
  });

  it('EN leadershipLevels has all 5 values', () => {
    const enLevels = Object.keys((en as any).core?.leadershipLevels || {});
    expect(enLevels.sort()).toEqual(LEADERSHIP_LEVELS.sort());
  });

  it('EN leadershipHelp has all 4 help keys', () => {
    const helpKeys = Object.keys((en as any).core?.leadershipHelp || {});
    expect(helpKeys.sort()).toEqual(['ADMINISTRATION_MANAGER', 'DEPARTMENT_HEAD', 'SUPERVISOR', 'TEAM_LEAD'].sort());
  });
});

describe('HIER-D English labels are not Arabic', () => {
  for (const level of LEADERSHIP_LEVELS) {
    it(`EN leadershipLevels.${level} is English text`, () => {
      const val = resolve(`core.leadershipLevels.${level}`, 'en');
      expect(val).not.toMatch(/[\u0600-\u06FF]/);
    });
  }
});

describe('HIER-D Arabic labels are not English', () => {
  for (const level of LEADERSHIP_LEVELS) {
    it(`AR leadershipLevels.${level} is Arabic text`, () => {
      const val = resolve(`core.leadershipLevels.${level}`, 'ar');
      expect(val).toMatch(/[\u0600-\u06FF]/);
    });
  }
});

describe('HIER-D person-assignments page source includes leadership fields', () => {
  const pagePath = path.resolve(__dirname, '../src/app/admin/core/person-assignments/page.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf-8');

  it('AssignmentForm has leadershipLevel field', () => {
    expect(pageSource).toMatch(/leadershipLevel:\s*string/);
  });

  it('TransferForm has leadershipLevel field', () => {
    const transferMatch = pageSource.match(/interface TransferForm[\s\S]*?\}/);
    expect(transferMatch?.[0]).toContain('leadershipLevel');
  });

  it('EMPTY_FORM defaults leadershipLevel to NONE', () => {
    expect(pageSource).toMatch(/EMPTY_FORM.*leadershipLevel.*NONE/);
  });

  it('EMPTY_TRANSFER_FORM defaults leadershipLevel to NONE', () => {
    expect(pageSource).toMatch(/EMPTY_TRANSFER_FORM.*leadershipLevel.*NONE/);
  });

  it('LEADERSHIP_LEVELS constant is defined with 5 values', () => {
    expect(pageSource).toContain("const LEADERSHIP_LEVELS = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER']");
  });

  it('Leadership level select is rendered in create/edit form', () => {
    expect(pageSource).toMatch(/LEADERSHIP_LEVELS\.map.*leadershipLevel/);
  });

  it('Leadership level select is rendered in transfer form', () => {
    expect(pageSource).toMatch(/transferForm\.leadershipLevel/);
  });

  it('Leadership level column is rendered in table header', () => {
    expect(pageSource).toContain("t('core.leadershipLevel')");
  });

  it('Leadership level badge is rendered in table rows', () => {
    expect(pageSource).toContain('leadershipLevels.${record.leadershipLevel}');
  });

  it('Leadership department required hint is shown for TEAM_LEAD/SUPERVISOR/DEPARTMENT_HEAD', () => {
    expect(pageSource).toContain("['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD'].includes(form.leadershipLevel)");
  });

  it('openEditModal sets leadershipLevel from record', () => {
    expect(pageSource).toContain("leadershipLevel: record.leadershipLevel || 'NONE'");
  });

  it('leadershipLevel is included in create payload (built via buildAssignmentUpdatePayload from form)', () => {
    expect(pageSource).toContain('const payload: any = buildAssignmentUpdatePayload(form);');
  });

  it('leadershipLevel is included in edit payload (built via buildAssignmentUpdatePayload from form)', () => {
    expect(pageSource).toContain('const payload: any = buildAssignmentUpdatePayload(form);');
  });

  it('leadershipLevel is included in transfer payload (transferForm fields used in transfer)', () => {
    expect(pageSource).toMatch(/leadershipLevel.*transferForm|transferForm.*leadershipLevel/);
  });
});

describe('HIER-D HIER-C page source includes leadership integration', () => {
  const pagePath = path.resolve(__dirname, '../src/app/admin/core/supervisor-assignments/page.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf-8');

  it('LeaderInfo interface has leadershipLevel', () => {
    expect(pageSource).toContain('leadershipLevel: string');
  });

  it('handleLeaderSelect maps leadershipLevel', () => {
    expect(pageSource).toContain("leadershipLevel: item.leadershipLevel || 'NONE'");
  });

  it('Leader summary card displays leadership level badge', () => {
    expect(pageSource).toContain('leaderInfo.leadershipLevel');
  });

  it('personAssignmentAdapter includes leadershipLevel column', () => {
    const adapterPath = path.resolve(__dirname, '../src/components/f9/lookup-adapters.ts');
    const adapterSource = fs.readFileSync(adapterPath, 'utf-8');
    expect(adapterSource).toContain("key: 'leadershipLevel'");
  });

  it('personAssignmentAdapter displayLabel includes leadership level', () => {
    const adapterPath = path.resolve(__dirname, '../src/components/f9/lookup-adapters.ts');
    const adapterSource = fs.readFileSync(adapterPath, 'utf-8');
    expect(adapterSource).toContain('leadershipLevel');
  });
});

describe('HIER-D Prisma schema has leadershipLevel field', () => {
  const schemaPath = path.resolve(__dirname, '../../api/prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  it('OperationalPersonAssignment has leadershipLevel String field with @default("NONE")', () => {
    const section = schema.match(/model OperationalPersonAssignment[\s\S]*?^\}/m);
    expect(section?.[0]).toMatch(/leadershipLevel\s+String\s+@default\("NONE"\)/);
  });

  it('leadershipLevel has an index', () => {
    expect(schema).toContain('@@index([leadershipLevel])');
  });
});

describe('HIER-D backend DTOs have leadershipLevel', () => {
  const createDtoPath = path.resolve(__dirname, '../../api/src/modules/admin/person-assignments/dto/create-person-assignment.dto.ts');
  const createDto = fs.readFileSync(createDtoPath, 'utf-8');

  it('CreatePersonAssignmentDto has leadershipLevel with @IsIn', () => {
    expect(createDto).toContain('leadershipLevel');
    expect(createDto).toMatch(/@IsIn[\s\S]*leadershipLevel|leadershipLevel[\s\S]*@IsIn/);
  });

  const transferDtoPath = path.resolve(__dirname, '../../api/src/modules/admin/person-assignments/dto/transfer-person-assignment.dto.ts');
  const transferDto = fs.readFileSync(transferDtoPath, 'utf-8');

  it('TransferPersonAssignmentDto has leadershipLevel with @IsIn', () => {
    expect(transferDto).toContain('leadershipLevel');
    expect(transferDto).toMatch(/@IsIn[\s\S]*leadershipLevel|leadershipLevel[\s\S]*@IsIn/);
  });
});

describe('HIER-D migration file exists and is safe', () => {
  const migrationPath = path.resolve(__dirname, '../../api/prisma/migrations/20260820100000_hier_d_add_leadership_level/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  it('adds leadershipLevel column with DEFAULT NONE', () => {
    expect(sql).toMatch(/ADD.*leadershipLevel.*DEFAULT.*NONE/i);
  });

  it('creates index on leadershipLevel', () => {
    expect(sql).toMatch(/CREATE INDEX.*leadershipLevel/i);
  });

  it('does not contain destructive operations', () => {
    expect(sql).not.toMatch(/TRUNCATE|DELETE|DROP TABLE|DROP COLUMN/i);
  });
});
