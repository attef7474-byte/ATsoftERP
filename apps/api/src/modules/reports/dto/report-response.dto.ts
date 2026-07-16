import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────── Summary Cards ───────────────────────────────

export class SummaryCardDto {
  @ApiProperty() label: string;
  @ApiProperty() value: number;
  @ApiPropertyOptional() unit?: string;
  @ApiPropertyOptional() trend?: 'up' | 'down' | 'neutral';
  @ApiPropertyOptional() helpText?: string;
}

// ─────────────────────────── Maintenance Overview ────────────────────────────

export class MaintenanceOverviewDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty() totalRequests: number;
  @ApiProperty() openRequests: number;
  @ApiProperty() inProgressRequests: number;
  @ApiProperty() completedRequests: number;
  @ApiProperty() cancelledRequests: number;
  @ApiProperty() overdueSchedules: number;
  @ApiProperty() totalDowntimeMinutes: number;
  @ApiProperty() activeDowntime: number;
  @ApiPropertyOptional() totalCost?: number;
  @ApiPropertyOptional() partsUsageCount?: number;
  @ApiProperty({ type: [Object] }) requestsByStatus: Record<string, number>[];
  @ApiProperty({ type: [Object] }) requestsByPriority: Record<string, number>[];
  @ApiProperty({ type: [Object] }) requestsByType: Record<string, number>[];
  @ApiProperty({ type: [Object] }) topMachinesByRequestCount: Record<string, any>[];
  @ApiProperty({ type: [Object] }) topMachinesByDowntime: Record<string, any>[];
  @ApiProperty({ type: [Object] }) dueSchedules: Record<string, any>[];
  @ApiProperty({ type: [Object] }) recentRequests: Record<string, any>[];
}

// ────────────────────────── Maintenance Requests Report ──────────────────────

export class MaintenanceRequestsReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ─────────────────────────── Machine Downtime Report ────────────────────────

export class MachineDowntimeReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ────────────────────────── Maintenance Costs Report ─────────────────────────

export class MaintenanceCostsReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ───────────────────────── Preventive Schedule Report ────────────────────────

export class PreventiveScheduleReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ──────────────────────────── Inventory Overview ─────────────────────────────

export class InventoryOverviewDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty() totalProducts: number;
  @ApiProperty() activeProducts: number;
  @ApiProperty() totalWarehouses: number;
  @ApiProperty() totalLocations: number;
  @ApiProperty() positiveBalanceProducts: number;
  @ApiProperty() zeroBalanceProducts: number;
  @ApiPropertyOptional() negativeBalanceProducts?: number;
  @ApiProperty() openCounts: number;
  @ApiProperty() completedCounts: number;
  @ApiProperty() postedMovements: number;
  @ApiProperty() postedAdjustments: number;
  @ApiProperty({ type: [Object] }) balancesByWarehouse: Record<string, any>[];
  @ApiProperty({ type: [Object] }) recentCounts: Record<string, any>[];
  @ApiProperty({ type: [Object] }) recentMovements: Record<string, any>[];
  @ApiProperty({ type: [Object] }) recentAdjustments: Record<string, any>[];
}

// ─────────────────────────── Inventory Balance Report ────────────────────────

export class InventoryBalanceReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ──────────────────────── Inventory Count Variance Report ────────────────────

export class InventoryCountVarianceReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ─────────────────────────── Inventory Movements Report ──────────────────────

export class InventoryMovementsReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ────────────────────────── Inventory Adjustments Report ─────────────────────

export class InventoryAdjustmentsReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}

// ──────────────────────────── Barcode Scans Report ───────────────────────────

export class BarcodeScansReportDto {
  @ApiProperty({ type: [SummaryCardDto] }) cards: SummaryCardDto[];
  @ApiProperty({ type: [Object] }) rows: Record<string, any>[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() totalPages: number;
}
