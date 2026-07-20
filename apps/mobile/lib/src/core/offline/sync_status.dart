class SyncStatus {
  final int pendingCount;
  final int failedCount;
  final int syncedCount;
  final bool isSyncing;
  final DateTime? lastSyncAt;
  final String? lastError;

  SyncStatus({
    this.pendingCount = 0,
    this.failedCount = 0,
    this.syncedCount = 0,
    this.isSyncing = false,
    this.lastSyncAt,
    this.lastError,
  });

  SyncStatus copyWith({
    int? pendingCount,
    int? failedCount,
    int? syncedCount,
    bool? isSyncing,
    DateTime? lastSyncAt,
    String? lastError,
  }) =>
      SyncStatus(
        pendingCount: pendingCount ?? this.pendingCount,
        failedCount: failedCount ?? this.failedCount,
        syncedCount: syncedCount ?? this.syncedCount,
        isSyncing: isSyncing ?? this.isSyncing,
        lastSyncAt: lastSyncAt ?? this.lastSyncAt,
        lastError: lastError ?? this.lastError,
      );
}
