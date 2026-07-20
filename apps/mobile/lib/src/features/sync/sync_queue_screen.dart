import 'package:flutter/material.dart';
import '../../core/offline/offline_queue.dart';
import '../../core/offline/offline_queue_item.dart';
import '../../core/offline/sync_service.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../l10n/app_localizations.dart';

class SyncQueueScreen extends StatefulWidget {
  final SyncService sync;

  const SyncQueueScreen({super.key, required this.sync});

  @override
  State<SyncQueueScreen> createState() => _SyncQueueScreenState();
}

class _SyncQueueScreenState extends State<SyncQueueScreen> {
  List<OfflineQueueItem> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.sync.addListener(_onSyncChange);
    _load();
  }

  @override
  void dispose() {
    widget.sync.removeListener(_onSyncChange);
    super.dispose();
  }

  void _onSyncChange() {
    if (mounted) setState(() {});
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await OfflineQueueDatabase.getAll();
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final syncStatus = widget.sync.status;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.syncQueue),
        actions: [
          if (syncStatus.pendingCount > 0)
            IconButton(
              icon: syncStatus.isSyncing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.sync),
              onPressed:
                  syncStatus.isSyncing ? null : () => widget.sync.syncAll(),
            ),
        ],
      ),
      body: _buildBody(t, theme, syncStatus),
    );
  }

  Widget _buildBody(
      AppLocalizations t, ThemeData theme, SyncStatus syncStatus) {
    if (_loading && _items.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: theme.colorScheme.primaryContainer.withAlpha(80),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.offlineInfo,
                    style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                )),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _statChip(Colors.blue, '${syncStatus.pendingCount}', t.pending),
                    const SizedBox(width: 8),
                    _statChip(Colors.red, '${syncStatus.failedCount}', t.failed),
                    const SizedBox(width: 8),
                    _statChip(Colors.green, '${syncStatus.syncedCount}', t.synced),
                  ],
                ),
                if (syncStatus.lastSyncAt != null) ...[
                  const SizedBox(height: 8),
                  Text('${t.lastSync}: ${_formatDate(syncStatus.lastSyncAt!)}',
                      style: theme.textTheme.labelSmall),
                ],
                if (syncStatus.isSyncing)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: LinearProgressIndicator(),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(t.syncQueue,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
            ),
            if (_items.any((i) => i.status == 'SYNCED'))
              TextButton(
                onPressed: () async {
                  await OfflineQueueDatabase.removeSynced();
                  _load();
                },
                child: Text(t.clearSynced),
              ),
          ],
        ),
        if (_items.isEmpty)
          const EmptyView(icon: Icons.cloud_done_outlined, title: 'All synced')
        else
          ..._items.map((item) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _statusColor(item.status).withAlpha(30),
                    radius: 18,
                    child: Icon(
                      _statusIcon(item.status),
                      color: _statusColor(item.status),
                      size: 18,
                    ),
                  ),
                  title: Text(item.operation, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${item.endpoint}\n${_formatDate(item.createdAt)}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: item.status == 'FAILED'
                      ? IconButton(
                          icon: const Icon(Icons.refresh, size: 20),
                          onPressed: () => widget.sync.syncAll(),
                        )
                      : null,
                ),
              )),
      ],
    );
  }

  Widget _statChip(Color color, String count, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(count,
              style: TextStyle(
                  fontWeight: FontWeight.bold, color: color, fontSize: 18)),
          Text(label, style: TextStyle(fontSize: 11, color: color)),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'PENDING':
        return Colors.blue;
      case 'SYNCED':
        return Colors.green;
      case 'FAILED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'PENDING':
        return Icons.hourglass_empty;
      case 'SYNCED':
        return Icons.check_circle;
      case 'FAILED':
        return Icons.error;
      default:
        return Icons.help_outline;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} '
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
