import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

function flatten(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = String(value);
    }
  }
  return out;
}

describe('validation namespace additions', () => {
  const enValidation = flatten((en as any).validation ?? {}, 'validation');
  const arValidation = flatten((ar as any).validation ?? {}, 'validation');

  it('provides duplicateValue and invalidReference in both locales', () => {
    expect(enValidation['validation.duplicateValue']?.trim().length).toBeGreaterThan(0);
    expect(arValidation['validation.duplicateValue']?.trim().length).toBeGreaterThan(0);
    expect(enValidation['validation.invalidReference']?.trim().length).toBeGreaterThan(0);
    expect(arValidation['validation.invalidReference']?.trim().length).toBeGreaterThan(0);
  });

  it('keeps the validation key sets synchronized between locales', () => {
    expect(Object.keys(enValidation).sort()).toEqual(Object.keys(arValidation).sort());
  });
});

describe('organization namespace', () => {
  const enOrganization = flatten((en as any).organization ?? {}, 'organization');
  const arOrganization = flatten((ar as any).organization ?? {}, 'organization');

  it('exists and contains content in both locales', () => {
    expect(Object.keys(enOrganization).length).toBeGreaterThan(0);
    expect(Object.keys(arOrganization).length).toBeGreaterThan(0);
  });

  it('keeps the organization key sets synchronized between locales', () => {
    expect(Object.keys(enOrganization).sort()).toEqual(Object.keys(arOrganization).sort());
  });

  it('translates every key in both languages', () => {
    for (const key of Object.keys(enOrganization)) {
      expect(enOrganization[key].trim().length).toBeGreaterThan(0);
      expect(arOrganization[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('covers every not-found key emitted by the backend services', () => {
    const required = [
      'organization.companyNotFound',
      'organization.branchNotFound',
      'organization.administrationNotFound',
      'organization.departmentNotFound',
      'organization.roleNotFound',
      'organization.permissionNotFound',
      'organization.userNotFound',
      'organization.systemRoleProtected',
      'organization.cannotDeleteRoleWithUsers',
      'organization.cannotRemoveLastSuperAdmin',
      'organization.cannotDeleteAdministrationWithDepartments',
      'organization.companyNotAllowed',
    ];
    for (const key of required) {
      expect(enOrganization[key]?.trim().length).toBeGreaterThan(0);
      expect(arOrganization[key]?.trim().length).toBeGreaterThan(0);
    }
  });
});
