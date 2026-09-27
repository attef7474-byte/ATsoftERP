export interface CanonicalCostBucket {
  key: string;
  netAmount: string;
  entryCount: number;
}

export interface CanonicalCostSourceReconciliation {
  sourceKind: string;
  sourceEntryCount: number;
  postedSourceEntryCount: number;
  unpostedSourceEntryCount: number;
  unpostedSourceEntryIds: string[];
  unpostedReason: 'WORK_ORDER_NOT_COMPLETED' | 'NO_UNPOSTED_SOURCES' | 'POSTING_GAP_AFTER_COMPLETION' | 'NOT_APPLICABLE';
  nextAction: string | null;
}

export interface CanonicalCostSummary {
  scope: 'REQUEST' | 'WORK_ORDER';
  entityId: string;
  entityNumber: string | null;
  status: string | null;
  currencyCode: string | null;
  netCost: string;
  postedEntryCount: number;
  reversalEntryCount: number;
  byEventType: CanonicalCostBucket[];
  byCostNature: CanonicalCostBucket[];
  byCurrency: CanonicalCostBucket[];
  nonCanonicalRowCount: number;
  nonCanonicalRowExplanation: string;
  sourceReconciliation: CanonicalCostSourceReconciliation;
}

export interface CloseReadinessBlocker {
  code: 'OPEN_TASKS' | 'UNRESOLVED_REQUIRED_PARTS' | 'ACTIVE_WORK_ORDERS' | 'MANDATORY_CHECKLIST_PENDING' | 'REQUEST_NOT_COMPLETED';
  count: number;
  messageKey: string;
  params: Record<string, string>;
}

export interface CloseReadiness {
  requestId: string;
  status: string;
  canComplete: boolean;
  canClose: boolean;
  completionBlockers: CloseReadinessBlocker[];
  closeBlockers: CloseReadinessBlocker[];
}
