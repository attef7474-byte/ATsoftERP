import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';

class MaintenanceLogScreen extends StatefulWidget {
  final ApiClient api;

  const MaintenanceLogScreen({super.key, required this.api});

  @override
  State<MaintenanceLogScreen> createState() => _MaintenanceLogScreenState();
}

class _MaintenanceLogScreenState extends State<MaintenanceLogScreen> {
  List<MaintenanceRequest> _logs = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? get _machineId =>
      ModalRoute.of(context)?.settings.arguments as String?;

  Future<void> _load() async {
    if (_machineId == null) return;
    setState(() => _loading = true);
    try {
      final response = await widget.api.get(
        '/maintenance/machines/$_machineId/maintenance-log',
      );
      final data = response['data'] as List<dynamic>? ??
          (response.containsKey('logs')
              ? response['logs'] as List<dynamic>
              : <dynamic>[]);
      setState(() {
        _logs = data
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
      appBar: AppBar(title: Text(t.maintenanceLog)),
      body: _buildBody(t),
    );
  }

  Widget _buildBody(AppLocalizations t) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_logs.isEmpty) return const EmptyView(title: 'No maintenance logs');

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _logs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final log = _logs[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _statusColor(log.status).withAlpha(30),
                child: Icon(Icons.build, color: _statusColor(log.status)),
              ),
              title: Text(log.title,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(
                '${log.type ?? ''} - ${log.priority ?? ''}',
                maxLines: 1,
              ),
              trailing: Chip(
                label: Text(log.status ?? '',
                    style: const TextStyle(fontSize: 11)),
                backgroundColor: _statusColor(log.status).withAlpha(25),
                side: BorderSide.none,
                visualDensity: VisualDensity.compact,
              ),
            ),
          );
        },
      ),
    );
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
