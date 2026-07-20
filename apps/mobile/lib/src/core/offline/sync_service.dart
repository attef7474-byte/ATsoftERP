import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import 'offline_queue.dart';
import 'offline_queue_item.dart';
import 'sync_status.dart';

class SyncService extends ChangeNotifier {
  final ApiClient _api;
  SyncStatus _status = SyncStatus();
  Timer? _syncTimer;

  SyncService(this._api) {
    _refreshCounts();
  }

  SyncStatus get status => _status;

  void startAutoSync({Duration interval = const Duration(minutes: 5)}) {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(interval, (_) => syncAll());
  }

  void stopAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  Future<void> enqueueScanEvent({
    required String scannedValue,
    String? purpose,
    String? note,
  }) async {
    await OfflineQueueDatabase.enqueue(OfflineQueueItem(
      operation: 'SCAN_EVENT',
      endpoint: '/barcodes/scan',
      method: 'POST',
      body: jsonEncode({
        'value': scannedValue,
        if (purpose != null) 'purpose': purpose,
        if (note != null) 'note': note,
        'source': 'MOBILE',
      }),
    ));
    _refreshCounts();
  }

  Future<void> enqueueMaintenanceRequest({
    required String machineId,
    required String title,
    String? description,
    String? type,
    String? priority,
  }) async {
    await OfflineQueueDatabase.enqueue(OfflineQueueItem(
      operation: 'CREATE_MAINTENANCE_REQUEST',
      endpoint: '/maintenance/requests',
      method: 'POST',
      body: jsonEncode({
        'machineId': machineId,
        'title': title,
        if (description != null) 'description': description,
        if (type != null) 'type': type,
        if (priority != null) 'priority': priority,
      }),
    ));
    _refreshCounts();
  }

  Future<void> enqueueInventoryCountLine({
    required String countId,
    required String productId,
    double? countedQty,
  }) async {
    await OfflineQueueDatabase.enqueue(OfflineQueueItem(
      operation: 'RECORD_COUNT',
      endpoint: '/inventory/counts/$countId/lines',
      method: 'POST',
      body: jsonEncode({
        'productId': productId,
        if (countedQty != null) 'countedQty': countedQty,
      }),
    ));
    _refreshCounts();
  }

  Future<void> syncAll() async {
    if (_status.isSyncing) return;

    _status = _status.copyWith(isSyncing: true);
    notifyListeners();

    final pending = await OfflineQueueDatabase.getPending();
    int synced = 0;
    String? lastError;

    for (final item in pending) {
      try {
        final body = item.body != null
            ? jsonDecode(item.body!) as Map<String, dynamic>
            : null;

        switch (item.method) {
          case 'POST':
            await _api.post(item.endpoint, body: body);
            break;
          case 'PATCH':
            await _api.patch(item.endpoint, body: body);
            break;
          case 'DELETE':
            await _api.delete(item.endpoint);
            break;
        }

        await OfflineQueueDatabase.markSynced(item.id!);
        synced++;
      } catch (e) {
        await OfflineQueueDatabase.incrementRetry(item.id!);
        if ((item.retryCount + 1) >= 3) {
          await OfflineQueueDatabase.markFailed(item.id!,
              retryCount: item.retryCount + 1);
        }
        lastError = e.toString();
      }
    }

    await OfflineQueueDatabase.removeSynced();
    await _refreshCounts();
    _status = _status.copyWith(
      isSyncing: false,
      lastSyncAt: DateTime.now(),
      syncedCount: _status.syncedCount + synced,
      lastError: lastError,
    );
    notifyListeners();
  }

  Future<void> _refreshCounts() async {
    _status = _status.copyWith(
      pendingCount: await OfflineQueueDatabase.getPendingCount(),
      failedCount: await OfflineQueueDatabase.getFailedCount(),
    );
    notifyListeners();
  }

  @override
  void dispose() {
    stopAutoSync();
    super.dispose();
  }
}
