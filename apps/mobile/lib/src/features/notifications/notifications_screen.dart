import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';

class NotificationsScreen extends StatefulWidget {
  final ApiClient api;

  const NotificationsScreen({super.key, required this.api});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final response = await widget.api.get('/notifications/inbox');
      final data = response['data'] as List<dynamic>? ??
          (response.containsKey('notifications')
              ? response['notifications'] as List<dynamic>
              : <dynamic>[]);
      setState(() {
        _items = data
            .map((e) => NotificationItem.fromJson(e as Map<String, dynamic>))
            .toList();
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _markRead(String id) async {
    try {
      await widget.api.patch('/notifications/$id/read');
      _load();
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    try {
      await widget.api.post('/notifications/mark-all-read');
      _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    return AppScaffold(
      currentIndex: 3,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(t.notifications,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold)),
                ),
                if (_items.isNotEmpty)
                  TextButton.icon(
                    onPressed: _markAllRead,
                    icon: const Icon(Icons.done_all, size: 18),
                    label: Text(t.markAllRead),
                  ),
              ],
            ),
          ),
          Expanded(child: _buildBody(t)),
        ],
      ),
    );
  }

  Widget _buildBody(AppLocalizations t) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_items.isEmpty) {
      return EmptyView(
        icon: Icons.notifications_off_outlined,
        title: t.noNotifications,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _items.length,
        itemBuilder: (_, i) {
          final n = _items[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: n.read
                    ? Colors.grey.withAlpha(20)
                    : Theme.of(context).colorScheme.primaryContainer,
                child: Icon(
                  _typeIcon(n.type),
                  color: n.read
                      ? Colors.grey
                      : Theme.of(context).colorScheme.onPrimaryContainer,
                  size: 20,
                ),
              ),
              title: Text(n.title,
                  style: TextStyle(
                    fontWeight: n.read ? FontWeight.normal : FontWeight.w600,
                  )),
              subtitle: Text(n.message, maxLines: 2),
              trailing: n.read
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.check_circle_outline, size: 20),
                      onPressed: () => _markRead(n.id),
                    ),
            ),
          );
        },
      ),
    );
  }

  IconData _typeIcon(String? type) {
    switch (type?.toUpperCase()) {
      case 'WARNING':
        return Icons.warning_amber;
      case 'ERROR':
        return Icons.error;
      case 'INFO':
        return Icons.info_outline;
      case 'SUCCESS':
        return Icons.check_circle;
      default:
        return Icons.notifications_outlined;
    }
  }
}
