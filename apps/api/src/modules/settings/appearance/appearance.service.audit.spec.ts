import { AppearanceService } from './appearance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('AppearanceService audit emission (Phase 6)', () => {
  let prisma: any;
  let audit: any;
  let service: AppearanceService;

  beforeEach(() => {
    prisma = {
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() };
    service = new AppearanceService(prisma as PrismaService, audit);
  });

  it('audits global appearance settings updates with previous and next values', async () => {
    prisma.systemSetting.findMany
      .mockResolvedValueOnce([{ key: 'appearance.themeMode', value: 'light' }])
      .mockResolvedValueOnce([
        { key: 'appearance.themeMode', value: 'dark' },
        { key: 'appearance.compactMode', value: 'true' },
      ]);

    await service.update({ themeMode: 'dark', compactMode: true }, 'actor-user');

    expect(audit.log).toHaveBeenCalledWith('actor-user', 'UPDATE', 'AppearanceSettings', 'appearance',
      expect.objectContaining({
        schemaVersion: 1,
        companyId: null,
        branchId: null,
        scope: 'GLOBAL_APPEARANCE_SETTINGS',
        actor: { userId: 'actor-user' },
        previous: expect.objectContaining({ themeMode: 'light', compactMode: false }),
        next: expect.objectContaining({ themeMode: 'dark', compactMode: true }),
        changedFields: ['themeMode', 'compactMode'],
        reason: 'APPEARANCE_SETTINGS_UPDATE',
      }));
  });

  it('does not emit an actorless audit row', async () => {
    prisma.systemSetting.findMany.mockResolvedValue([]);

    await service.update({ themeMode: 'dark' });

    expect(audit.log).not.toHaveBeenCalled();
    expect(prisma.systemSetting.upsert).toHaveBeenCalled();
  });
});
