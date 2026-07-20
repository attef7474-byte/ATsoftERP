import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/offline/sync_service.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';
import '../../config/mobile_routes.dart';

class MaintenanceRequestsScreen extends StatefulWidget {
  final ApiClient api;
  final SyncService sync;

  const MaintenanceRequestsScreen({
    super.key,
    required this.api,
    required this.sync,
  });

  @override
  State<MaintenanceRequestsScreen> createState() =>
      _MaintenanceRequestsScreenState();
}

class _MaintenanceRequestsScreenState
    extends State<MaintenanceRequestsScreen> {
  List<MaintenanceRequest> _requests = [];
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
      final response = await widget.api.get('/maintenance/requests');
      final data = response['data'] as List<dynamic>? ??
          (response.containsKey('requests')
              ? response['requests'] as List<dynamic>
              : <dynamic>[]);
      setState(() {
        _requests = data
            .map((e) => MaintenanceRequest.fromJson(e as Map<String, dynamic>))
            .toList();
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(t.maintenance),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => Navigator.pushNamed(
              context,
              MobileRoutes.maintenanceRequestCreate,
            ).then((_) => _load()),
          ),
        ],
      ),
      body: _buildBody(t),
    );
  }

  Widget _buildBody(AppLocalizations t) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_requests.isEmpty) {
      return EmptyView(
        title: 'No requests',
        action: FilledButton.icon(
          onPressed: () => Navigator.pushNamed(
            context,
            MobileRoutes.maintenanceRequestCreate,
          ).then((_) => _load()),
          icon: const Icon(Icons.add),
          label: Text(t.createRequest),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _requests.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final r = _requests[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _priorityColor(r.priority).withAlpha(30),
                child: Icon(Icons.build,
                    color: _priorityColor(r.priority), size: 20),
              ),
              title: Text(r.title,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(
                '${r.machineName ?? r.machineId} - ${r.type ?? ""}',
                maxLines: 1,
              ),
              trailing: Chip(
                label: Text(r.status ?? '',
                    style: const TextStyle(fontSize: 11)),
                backgroundColor: _statusColor(r.status).withAlpha(25),
                side: BorderSide.none,
                visualDensity: VisualDensity.compact,
              ),
              onTap: () => Navigator.pushNamed(
                context,
                MobileRoutes.maintenanceRequestDetail,
                arguments: r.id,
              ),
            ),
          );
        },
      ),
    );
  }

  Color _priorityColor(String? priority) {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return Colors.red;
      case 'HIGH':
        return Colors.orange;
      case 'MEDIUM':
        return Colors.amber;
      case 'LOW':
        return Colors.green;
      default:
        return Colors.blue;
    }
  }

  Color _statusColor(String? status) {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return Colors.blue;
      case 'IN_PROGRESS':
        return Colors.orange;
      case 'COMPLETED':
        return Colors.green;
      case 'CANCELLED':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }
}
