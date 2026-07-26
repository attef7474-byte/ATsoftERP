import { Injectable } from '@nestjs/common';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';

@Injectable()
export class MaintenanceReliabilityService {
  constructor(private downtimeLogsService: DowntimeLogsService) {}

  async getMttr(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getMttr(query);
  }

  async getMtbf(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getMtbf(query);
  }

  async getTotalDowntime(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getTotalDowntime(query);
  }

  async getDowntimeByMachine(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.downtimeLogsService.getDowntimeByMachine(query);
  }

  async getDowntimeByProductionLine(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getDowntimeByProductionLine(query);
  }

  async getDowntimeByCause(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getDowntimeByCause(query);
  }

  async getRepeatFailures(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.downtimeLogsService.getRepeatFailures(query);
  }

  async getEmergencyResponseTime(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getEmergencyResponseTime(query);
  }

  async getTopMachines(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.downtimeLogsService.getTopMachines(query);
  }

  async getTopCauses(query: { dateFrom?: string; dateTo?: string }) {
    return this.downtimeLogsService.getTopCauses(query);
  }
}
