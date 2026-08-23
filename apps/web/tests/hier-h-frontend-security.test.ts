import {
  translatePermissionKey,
  translateRoleName,
  translateRoleDescription,
  translateEnum,
} from '../src/lib/i18n/literals';
import { resolveTranslation } from '../src/lib/i18n/translation-core';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { Locale } from '../src/lib/i18n/types';

describe('HIER-H Frontend Security — Hierarchy Permissions', () => {
  describe('§17 Raw Permission Key Protection', () => {
    const HIER_KEYS = [
      'person-assignment:create',
      'person-assignment:read',
      'person-assignment:update',
      'person-assignment:transfer',
      'supervisor:read',
      'supervisor:assign',
      'supervisor:remove',
    ];

    it('HIERARCHY_RAW_KEY_PROTECTION: all hierarchy permission keys have EN translations that do not contain raw key', () => {
      for (const key of HIER_KEYS) {
        const label = translatePermissionKey(key, 'en' as Locale);
        expect(label.toLowerCase()).not.toContain(key.toLowerCase());
        expect(label).not.toMatch(/^[a-z]+[:.]/);
      }
    });

    it('HIERARCHY_RAW_KEY_PROTECTION: all hierarchy permission keys have AR translations that do not contain raw key', () => {
      for (const key of HIER_KEYS) {
        const label = translatePermissionKey(key, 'ar' as Locale);
        expect(label).not.toContain(key.split(':')[0]);
        expect(label).not.toContain(':');
      }
    });
  });

  describe('§17 Authorization Message i18n', () => {
    it('auth.insufficientPermissions has both AR and EN translations', () => {
      const enMsg = resolveTranslation(en, 'en', 'auth.insufficientPermissions');
      const arMsg = resolveTranslation(ar, 'ar', 'auth.insufficientPermissions');
      expect(enMsg).toBeTruthy();
      expect(arMsg).toBeTruthy();
      expect(enMsg).not.toContain('auth.insufficientPermissions');
      expect(arMsg).not.toContain('auth.insufficientPermissions');
    });

    it('auth.noUserFound does not leak raw key path in translation', () => {
      const enMsg = resolveTranslation(en, 'en', 'auth.noUserFound');
      const arMsg = resolveTranslation(ar, 'ar', 'auth.noUserFound');
      expect(enMsg).toBeTruthy();
      expect(arMsg).toBeTruthy();
      expect(enMsg).not.toContain('auth.noUserFound');
      expect(arMsg).not.toContain('auth.noUserFound');
    });

    it('common.internalError does not leak raw key path in translation', () => {
      const enMsg = resolveTranslation(en, 'en', 'common.internalError');
      const arMsg = resolveTranslation(ar, 'ar', 'common.internalError');
      expect(enMsg).toBeTruthy();
      expect(arMsg).toBeTruthy();
      expect(enMsg).not.toContain('common.internalError');
      expect(arMsg).not.toContain('common.internalError');
    });
  });

  describe('§17 Permission Enum Translation', () => {
    it('leadershipLevel enums produce non-empty EN and AR labels without crashing', () => {
      const levels = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];
      for (const value of levels) {
        const enLabel = translateEnum(value, 'en' as Locale);
        const arLabel = translateEnum(value, 'ar' as Locale);
        expect(enLabel).toBeTruthy();
        expect(arLabel).toBeTruthy();
        expect(typeof enLabel).toBe('string');
        expect(typeof arLabel).toBe('string');
      }
    });

    it('assignmentType enums produce non-empty labels without crashing', () => {
      const types = ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'];
      for (const type of types) {
        const enLabel = translateEnum(type, 'en' as Locale);
        const arLabel = translateEnum(type, 'ar' as Locale);
        expect(enLabel).toBeTruthy();
        expect(arLabel).toBeTruthy();
      }
    });

    it('relationshipType enums produce non-empty labels without crashing', () => {
      const types = ['DIRECT', 'MATRIX', 'FUNCTIONAL'];
      for (const type of types) {
        const enLabel = translateEnum(type, 'en' as Locale);
        const arLabel = translateEnum(type, 'ar' as Locale);
        expect(enLabel).toBeTruthy();
        expect(arLabel).toBeTruthy();
      }
    });

    it('supervisionStatus enums produce non-empty labels without crashing', () => {
      const statuses = ['ELIGIBLE', 'ALREADY_ON_THIS_TEAM', 'HAS_OTHER_DIRECT_SUPERVISOR', 'SELF', 'OUTSIDE_ALLOWED_BRANCH_SCOPE'];
      for (const status of statuses) {
        const enLabel = translateEnum(status, 'en' as Locale);
        const arLabel = translateEnum(status, 'ar' as Locale);
        expect(enLabel).toBeTruthy();
        expect(arLabel).toBeTruthy();
      }
    });

    it('all hierarchy enum translations return safe string (not undefined/null)', () => {
      const allEnums = [
        'NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER',
        'PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING',
        'DIRECT', 'MATRIX', 'FUNCTIONAL',
        'ELIGIBLE', 'ALREADY_ON_THIS_TEAM', 'HAS_OTHER_DIRECT_SUPERVISOR', 'SELF', 'OUTSIDE_ALLOWED_BRANCH_SCOPE',
      ];
      for (const val of allEnums) {
        const enResult = translateEnum(val, 'en' as Locale);
        const arResult = translateEnum(val, 'ar' as Locale);
        expect(typeof enResult).toBe('string');
        expect(typeof arResult).toBe('string');
        expect(enResult.length).toBeGreaterThan(0);
        expect(arResult.length).toBeGreaterThan(0);
      }
    });
  });

  describe('§17 CUID / Raw ID Protection in Translations', () => {
    it('no hierarchy translations contain CUID patterns (clxxxx...)', () => {
      const cuidPattern = /^cl[a-z0-9]{20,}$/i;
      const allEn = JSON.stringify(en);
      const allAr = JSON.stringify(ar);
      expect(allEn).not.toMatch(cuidPattern);
      expect(allAr).not.toMatch(cuidPattern);
    });

    it('no hierarchy translations contain UUID patterns', () => {
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const allEn = JSON.stringify(en);
      const allAr = JSON.stringify(ar);
      expect(allEn).not.toMatch(uuidPattern);
      expect(allAr).not.toMatch(uuidPattern);
    });
  });

  describe('§17 Fallback Safety', () => {
    it('unknown permission key returns humanized safe fallback (not raw key)', () => {
      const label = translatePermissionKey('nonexistent:permission', 'en' as Locale);
      expect(label).toBeTruthy();
      expect(label).not.toContain('nonexistent:permission');
      expect(label).not.toMatch(/^[a-z]+:[a-z]+$/);
    });

    it('unknown enum value returns humanized value (no crash)', () => {
      const label = translateEnum('UNKNOWN_VALUE', 'en' as Locale);
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
    });
  });

  describe('§17 Mutation Control Language', () => {
    it('remove-related translations use distinct action verbs from create', () => {
      const createLabel = translatePermissionKey('supervisor:assign', 'en' as Locale);
      const removeLabel = translatePermissionKey('supervisor:remove', 'en' as Locale);
      expect(createLabel).not.toBe(removeLabel);
    });

    it('transfer translation is distinct from create', () => {
      const createLabel = translatePermissionKey('person-assignment:create', 'en' as Locale);
      const transferLabel = translatePermissionKey('person-assignment:transfer', 'en' as Locale);
      expect(createLabel).not.toBe(transferLabel);
    });

    it('AR remove-related translations are distinct from create', () => {
      const createLabel = translatePermissionKey('supervisor:assign', 'ar' as Locale);
      const removeLabel = translatePermissionKey('supervisor:remove', 'ar' as Locale);
      expect(createLabel).not.toBe(removeLabel);
    });
  });
});
