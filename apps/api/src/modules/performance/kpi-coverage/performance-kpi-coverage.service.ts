import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceKpiPreviewService } from '../kpi-preview/performance-kpi-preview.service';

@Injectable()
export class PerformanceKpiCoverageService {
  constructor(private prisma: PrismaService, private preview: PerformanceKpiPreviewService) {}

  async coverage(query: any, ctx: ActiveOperationalContext) {
    const dateFrom = String(query.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString());
    const dateTo = String(query.dateTo || new Date().toISOString());
    const kpiCode = query.kpiCode ? String(query.kpiCode) : null;
    const profileId = query.performanceProfileId ? String(query.performanceProfileId) : null;

    const kpiWhere: any = { companyId: ctx.companyId, deletedAt: null, status: 'ACTIVE', isActive: true };
    if (kpiCode) kpiWhere.code = kpiCode;
    const kpis = await this.prisma.performanceKpiDefinition.findMany({ where: kpiWhere, orderBy: [{ domain: 'asc' }, { code: 'asc' }], take: 100 });
    if (kpis.length === 0) return { period: { from: dateFrom, to: dateTo }, items: [] };

    const profiles = await this.prisma.performanceProfile.findMany({ where: { companyId: ctx.companyId, deletedAt: null, isActive: true, ...(profileId ? { id: profileId } : {}) }, select: { id: true, code: true, name: true, nameAr: true, nameEn: true } });
    const eligibilities = await this.prisma.performanceProfileKpiEligibility.findMany({ where: { companyId: ctx.companyId, deletedAt: null, isEnabled: true, kpiDefinitionId: { in: kpis.map(k => k.id) }, ...(profileId ? { performanceProfileId: profileId } : {}) }, select: { performanceProfileId: true, kpiDefinitionId: true } });

    // employees in context
    const now = new Date();
    const assignments = await this.prisma.operationalPersonAssignment.findMany({ where: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null, status: 'ACTIVE', effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }], person: { isActive: true } }, select: { personnelId: true }, distinct: ['personnelId'], take: 200 });
    const personIds = assignments.map(a => a.personnelId);

    // resolve each person's current profile by asking context service indirectly via preview? expensive. Instead use a light profile resolution by querying mappings is hard; reuse preview but limit.
    // For coverage we compute per KPI+profile group by sampling eligible employees (bounded).
    const items: any[] = [];
    for (const kpi of kpis) {
      const eligibleProfileIds = eligibilities.filter(e => e.kpiDefinitionId === kpi.id).map(e => e.performanceProfileId);
      const eligibleProfiles = profiles.filter(p => eligibleProfileIds.includes(p.id));
      let calculable = 0, insufficientData = 0, notApplicable = 0, attributionAmbiguous = 0, sourceUnavailable = 0, configMissing = 0;
      let eligibleEmployees = 0;
      const sampleIssues: Record<string, number> = {};

      // evaluate up to 50 eligible employees per KPI for responsiveness
      for (const personId of personIds) {
        // quick eligibility check by resolving profile through preview? we'll call preview; it's bounded by personIds<=200 and kpis maybe few - but can be heavy.
        // to stay bounded, only evaluate if we haven't reached 25 eligible employees for this KPI
        if (eligibleEmployees >= 25) break;
        try {
          const res = await this.preview.preview({ operationalPersonId: personId, kpiCode: kpi.code, dateFrom, dateTo, evidenceLimit: 1 } as any, ctx);
          if (res.status === 'NOT_APPLICABLE' && res.dataQuality?.issues?.includes('notEligibleForProfile')) continue;
          eligibleEmployees += 1;
          if (res.status === 'CALCULABLE') calculable++;
          else if (res.status === 'INSUFFICIENT_DATA') insufficientData++;
          else if (res.status === 'NOT_APPLICABLE') notApplicable++;
          else if (res.status === 'ATTRIBUTION_AMBIGUOUS') attributionAmbiguous++;
          else if (res.status === 'SOURCE_UNAVAILABLE') sourceUnavailable++;
          else if (res.status === 'CONFIGURATION_MISSING') configMissing++;
          for (const issue of (res.dataQuality?.issues || [])) sampleIssues[issue] = (sampleIssues[issue] || 0) + 1;
        } catch { /* ignore per-person errors in coverage */ }
      }

      items.push({
        kpi: { id: kpi.id, code: kpi.code, name: kpi.name, nameAr: kpi.nameAr, nameEn: kpi.nameEn, domain: kpi.domain, measurementUnit: kpi.measurementUnit, direction: kpi.direction },
        eligibleProfiles: eligibleProfiles.map(p => ({ id: p.id, code: p.code, name: p.name })),
        eligibleEmployeesSampled: eligibleEmployees,
        calculable, insufficientData, notApplicable, attributionAmbiguous, sourceUnavailable, configMissing,
        sampleIssues,
      });
    }
    return { period: { from: dateFrom, to: dateTo }, items };
  }
}
