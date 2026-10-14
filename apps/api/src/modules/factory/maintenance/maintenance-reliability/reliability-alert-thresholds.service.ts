import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ReliabilityAlertThresholds } from './reliability-alert-calculations';

export const RELIABILITY_ALERTS_SETTINGS_GROUP = 'reliability-alerts';
export const REPLACEMENT_FREQUENCY_WINDOW_KEY = 'reliability.alerts.replacementFrequencyWindowDays';
export const REPLACEMENT_FREQUENCY_MAX_KEY = 'reliability.alerts.replacementFrequencyMaxCount';

/**
 * Loads alert thresholds from the canonical SystemSetting store (no migration).
 *
 * The life-band thresholds are NOT configured here: they already live in
 * canonical domain configuration (per-instance `warning_threshold_percent`
 * and the `DUE_PROGRESS_THRESHOLD`/EXPIRED bands) and are consumed through the
 * canonical expected-life result. Only the replacement-frequency threshold —
 * which has no canonical value — is read here; if it is absent the category is
 * NOT_ELIGIBLE rather than invented (see reliability-alert-calculations.ts).
 */
@Injectable()
export class ReliabilityAlertThresholdsService {
  constructor(private prisma: PrismaService) {}

  private toPositiveInt(value: string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  }

  async load(): Promise<ReliabilityAlertThresholds> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { group: RELIABILITY_ALERTS_SETTINGS_GROUP, status: 'ACTIVE' },
      select: { key: true, value: true },
    });
    const map = new Map<string, string>((rows as any[]).map((r) => [r.key, r.value]));
    return {
      replacementFrequencyWindowDays: this.toPositiveInt(map.get(REPLACEMENT_FREQUENCY_WINDOW_KEY)),
      replacementFrequencyMaxCount: this.toPositiveInt(map.get(REPLACEMENT_FREQUENCY_MAX_KEY)),
    };
  }
}
