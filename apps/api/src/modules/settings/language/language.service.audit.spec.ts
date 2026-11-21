import { LanguageService } from './language.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('LanguageService audit emission (Phase 6)', () => {
  let prisma: any;
  let audit: any;
  let service: LanguageService;

  beforeEach(() => {
    prisma = {
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() };
    service = new LanguageService(prisma as PrismaService, audit);
  });

  it('audits global language settings updates with previous and next values', async () => {
    prisma.systemSetting.findMany
      .mockResolvedValueOnce([
        { key: 'language.defaultLocale', value: 'ar' },
        { key: 'language.rtlEnabled', value: 'false' },
      ])
      .mockResolvedValueOnce([
        { key: 'language.defaultLocale', value: 'en' },
        { key: 'language.rtlEnabled', value: 'true' },
      ]);

    await service.update({ defaultLocale: 'en', rtlEnabled: true }, 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'UPDATE', 'LanguageSettings', 'language',
      expect.objectContaining({
        schemaVersion: 1,
        companyId: null,
        branchId: null,
        scope: 'GLOBAL_LANGUAGE_SETTINGS',
        actor: { userId: 'actor-user' },
        previous: expect.objectContaining({ defaultLocale: 'ar', rtlEnabled: false }),
        next: expect.objectContaining({ defaultLocale: 'en', rtlEnabled: true }),
        changedFields: ['defaultLocale', 'rtlEnabled'],
        reason: 'LANGUAGE_SETTINGS_UPDATE',
      }));
  });

  it('does not emit an actorless audit row', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([]);

    await service.update({ defaultLocale: 'en' });

    expect(audit.log).not.toHaveBeenCalled();
    expect(prisma.systemSetting.upsert).toHaveBeenCalled();
  });
});
