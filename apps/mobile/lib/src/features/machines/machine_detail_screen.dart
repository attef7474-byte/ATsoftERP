import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';
import '../../config/mobile_routes.dart';

class MachineDetailScreen extends StatefulWidget {
  final ApiClient api;

  const MachineDetailScreen({super.key, required this.api});

  @override
  State<MachineDetailScreen> createState() => _MachineDetailScreenState();
}

class _MachineDetailScreenState extends State<MachineDetailScreen> {
  Machine? _machine;
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
      final response =
          await widget.api.get('/maintenance/machines/$_machineId');
      setState(() {
        _machine = Machine.fromJson(response);
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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(_machine?.name ?? t.machineDetail),
      ),
      body: _buildBody(t, theme),
    );
  }

  Widget _buildBody(AppLocalizations t, ThemeData theme) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_machine == null) return const SizedBox.shrink();

    final m = _machine!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: theme.colorScheme.primaryContainer,
                      child: Icon(Icons.precision_manufacturing,
                          color: theme.colorScheme.onPrimaryContainer),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(m.name,
                              style: theme.textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          Text(m.code,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24),
                _detailRow(t.code, m.code),
                if (m.model != null) _detailRow(t.model, m.model!),
                if (m.serialNumber != null)
                  _detailRow(t.serialNumber, m.serialNumber!),
                if (m.manufacturer != null)
                  _detailRow(t.manufacturer, m.manufacturer!),
                if (m.location != null) _detailRow(t.location, m.location!),
                _detailRow(t.status, m.status ?? t.active),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _actionCard(t, Icons.build_outlined, t.maintenanceLog,
            MobileRoutes.maintenanceLog, m.id),
        const SizedBox(height: 8),
        _actionCard(t, Icons.assignment_outlined, t.maintenanceRequests,
            '${MobileRoutes.maintenanceRequests}?machineId=${m.id}', m.id),
        const SizedBox(height: 8),
        _actionCard(t, Icons.qr_code_scanner, t.scanBarcode,
            MobileRoutes.scanner, m.id),
      ],
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 13,
                )),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }

  Widget _actionCard(AppLocalizations t, IconData icon, String label,
      String route, String machineId) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.pushNamed(
          context,
          route,
          arguments: machineId,
        ),
      ),
    );
  }
}
