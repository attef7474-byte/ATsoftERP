import { AppearanceService } from './appearance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('AppearanceService', () => {
  let prisma: any;
  let service: AppearanceService;

  beforeEach(() => {
    prisma = {
      systemSetting: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new AppearanceService(prisma as PrismaService);
  });

  describe('get', () => {
    it('returns typed defaults when nothing is stored', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const settings = await service.get();

      expect(settings).toEqual({
        themeMode: 'light',
        primaryColor: '#2563eb',
        accentColor: '#14b8a6',
        colorIntensity: 70,
        gradientEnabled: true,
        gradientStrength: 70,
        gradientFocus: 'BALANCED',
        gradientDirection: 'BILATERAL_CENTER',
        preset: 'REFERENCE_DEFAULT',
        fontScale: 'medium',
        shadowDepth: 'medium',
        radius: 'medium',
        glassOpacity: 0.72,
        glassBlur: 14,
        compactMode: false,
        sidebarCollapsed: false,
        sidebarBg: 'navy',
        sidebarAccent: 'teal',
        sidebarDensity: 'default',
        sidebarFont: 'normal',
        tableDensity: 'default',
        showStatusBar: true,
        showActionBar: true,
      });
    });

    it('normalizes stored strings into numbers and booleans', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { key: 'appearance.primaryColor', value: '#123456' },
        { key: 'appearance.colorIntensity', value: '25' },
        { key: 'appearance.gradientStrength', value: '40' },
        { key: 'appearance.glassOpacity', value: '0.5' },
        { key: 'appearance.glassBlur', value: '9' },
        { key: 'appearance.gradientEnabled', value: 'false' },
        { key: 'appearance.compactMode', value: 'true' },
        { key: 'appearance.showStatusBar', value: 'false' },
      ]);

      const settings = await service.get();

      expect(settings.primaryColor).toBe('#123456');
      expect(settings.colorIntensity).toBe(25);
      expect(settings.gradientStrength).toBe(40);
      expect(settings.glassOpacity).toBe(0.5);
      expect(settings.glassBlur).toBe(9);
      expect(settings.gradientEnabled).toBe(false);
      expect(settings.compactMode).toBe(true);
      expect(settings.showStatusBar).toBe(false);
      expect(settings.showActionBar).toBe(true);
    });

    it('falls back to the legacy appearance.shadow key', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([
        { key: 'appearance.shadow', value: 'strong' },
      ]);

      const settings = await service.get();

      expect(settings.shadowDepth).toBe('strong');
    });
  });

  describe('update', () => {
    it('upserts only the provided fields', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);
      prisma.systemSetting.upsert.mockImplementation(async (args: any) => args);

      await service.update({ primaryColor: '#ff0000', glassBlur: 22, showActionBar: false });

      expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(3);
      const keys = prisma.systemSetting.upsert.mock.calls.map((call: any[]) => call[0].where.key).sort();
      expect(keys).toEqual(['appearance.glassBlur', 'appearance.primaryColor', 'appearance.showActionBar']);
      const stored = Object.fromEntries(
        prisma.systemSetting.upsert.mock.calls.map((call: any[]) => [call[0].where.key, call[0].update.value]),
      );
      expect(stored).toEqual({
        'appearance.primaryColor': '#ff0000',
        'appearance.glassBlur': '22',
        'appearance.showActionBar': 'false',
      });
    });

    it('does not upsert anything for an empty payload and returns stored settings', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const settings = await service.update({});

      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
      expect(settings.gradientEnabled).toBe(true);
    });

    it('stores booleans as literal true/false strings', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);
      prisma.systemSetting.upsert.mockImplementation(async (args: any) => args);

      await service.update({ gradientEnabled: true, compactMode: false });

      const stored = Object.fromEntries(
        prisma.systemSetting.upsert.mock.calls.map((call: any[]) => [call[0].where.key, call[0].update.value]),
      );
      expect(stored['appearance.gradientEnabled']).toBe('true');
      expect(stored['appearance.compactMode']).toBe('false');
    });

    it('applies the REFERENCE_DEFAULT preset to reset all fields', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);
      prisma.systemSetting.upsert.mockImplementation(async (args: any) => args);

      await service.update({ preset: 'REFERENCE_DEFAULT' });

      const stored = Object.fromEntries(
        prisma.systemSetting.upsert.mock.calls.map((call: any[]) => [call[0].where.key, call[0].update.value]),
      );
      expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(24);
      expect(stored['appearance.primaryColor']).toBe('#2563eb');
      expect(stored['appearance.accentColor']).toBe('#14b8a6');
      expect(stored['appearance.compactMode']).toBe('false');
      expect(stored['appearance.glassOpacity']).toBe('0.72');
      expect(stored['appearance.gradientStrength']).toBe('70');
    });

    it('applies a partial preset then lets explicit fields override', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);
      prisma.systemSetting.upsert.mockImplementation(async (args: any) => args);

      await service.update({ preset: 'GLASS', primaryColor: '#ff0000' });

      const stored = Object.fromEntries(
        prisma.systemSetting.upsert.mock.calls.map((call: any[]) => [call[0].where.key, call[0].update.value]),
      );
      expect(stored['appearance.glassOpacity']).toBe('0.55');
      expect(stored['appearance.glassBlur']).toBe('22');
      expect(stored['appearance.gradientStrength']).toBe('55');
      expect(stored['appearance.primaryColor']).toBe('#ff0000');
    });

    it('applies the FLAT preset disabling gradients', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);
      prisma.systemSetting.upsert.mockImplementation(async (args: any) => args);

      await service.update({ preset: 'FLAT' });

      const stored = Object.fromEntries(
        prisma.systemSetting.upsert.mock.calls.map((call: any[]) => [call[0].where.key, call[0].update.value]),
      );
      expect(stored['appearance.gradientEnabled']).toBe('false');
      expect(stored['appearance.gradientStrength']).toBe('0');
    });
  });
});
