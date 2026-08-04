export type RunStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ABORTED';
export type OutputEventType = 'PRODUCTION' | 'CORRECTION' | 'RESET';
export type MeasurementRole = 'INPUT' | 'INTERMEDIATE' | 'FINAL_OUTPUT' | 'WASTE' | 'REWORK';
export type MeasurementSource = 'MANUAL' | 'COUNTER';
export type AssignmentResolutionSource = 'RESOURCE' | 'EXPLICIT';

export interface ResolvedRunAssignments {
  shiftId: string | null;
  shiftCodeSnapshot: string | null;
  shiftNameSnapshot: string | null;
  shiftStartTimeSnapshot: string | null;
  shiftEndTimeSnapshot: string | null;
  shiftAssignmentId: string | null;
  shiftAssignmentCodeSnapshot: string | null;
  operationalAssignmentId: string | null;
  operationalAssignmentCodeSnapshot: string | null;
  operationalPersonId: string | null;
  operationalPersonCodeSnapshot: string | null;
  operationalPersonNameSnapshot: string | null;
  assignmentResolutionSource: AssignmentResolutionSource;
  assignmentResolutionNote: string | null;
}

export interface DerivedClassificationTotals {
  quantity: string;
  goodQuantity: string;
  rejectQuantity: string;
  eventCount: number;
}

export interface DerivedRunTotals {
  byClassification: Record<string, DerivedClassificationTotals>;
  finalOutputTotal: string;
  finalOutputGood: string;
  finalOutputReject: string;
  finalOutputEventCount: number;
  totalEvents: number;
  wasteTotal: string;
  reworkTotal: string;
  correctionsTotal: string;
  progressPercent: string;
}