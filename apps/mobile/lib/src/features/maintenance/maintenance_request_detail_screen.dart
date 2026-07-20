import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';

class MaintenanceRequestDetailScreen extends StatefulWidget {
  final ApiClient api;

  const MaintenanceRequestDetailScreen({super.key, required this.api});

  @override
  State<MaintenanceRequestDetailScreen> createState() =>
      _MaintenanceRequestDetailScreenState();
}

class _MaintenanceRequestDetailScreenState
    extends State<MaintenanceRequestDetailScreen> {
  MaintenanceRequest? _request;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? get _requestId =>
      ModalRoute.of(context)?.settings.arguments as String?;

  Future<void> _load() async {
    if (_requestId == null) return;
    setState(() => _loading = true);
    try {
      final response =
          await widget.api.get('/maintenance/requests/$_requestId');
      setState(() {
        _request = MaintenanceRequest.fromJson(response);
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _transition(String action) async {
    try {
      await widget.api.patch(
        '/maintenance/requests/$_requestId/$action',
      );
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(t.requestDetail)),
      body: _buildBody(t, theme),
    );
  }

  Widget _buildBody(AppLocalizations t, ThemeData theme) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_request == null) return const SizedBox.shrink();

    final r = _request!;
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
                    Expanded(
                      child: Text(r.title,
                          style: theme.textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.bold)),
                    ),
                    Chip(
                      label: Text(r.status ?? '',
                          style: const TextStyle(fontSize: 11)),
                      backgroundColor:
                          _statusColor(r.status).withAlpha(25),
                      side: BorderSide.none,
                    ),
                  ],
                ),
                const Divider(height: 24),
                _row(t.status, r.status ?? ''),
                _row(t.priority, r.priority ?? ''),
                _row(t.type, r.type ?? ''),
                _row('Machine', r.machineName ?? r.machineId),
                if (r.description != null && r.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(t.description,
                      style: theme.textTheme.labelMedium
                          ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 4),
                  Text(r.description!),
                ],
                if (r.notes != null && r.notes!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(t.notes,
                      style: theme.textTheme.labelMedium
                          ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 4),
                  Text(r.notes!),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _buildActions(t, r.status),
      ],
    );
  }

  Widget _buildActions(AppLocalizations t, String? status) {
    final actions = <Widget>[];
    if (status == 'OPEN') {
      actions.add(_actionBtn(t.start, Icons.play_arrow, () => _transition('start')));
    }
    if (status == 'IN_PROGRESS') {
      actions.add(_actionBtn(t.complete, Icons.check, () => _transition('complete')));
    }
    if (status == 'OPEN' || status == 'IN_PROGRESS') {
      actions.add(_actionBtn(t.cancel, Icons.cancel, () => _transition('cancel'),
          isDestructive: true));
    }
    if (status == 'CANCELLED' || status == 'COMPLETED') {
      actions.add(_actionBtn('Reopen', Icons.replay, () => _transition('reopen')));
    }

    if (actions.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: actions,
    );
  }

  Widget _actionBtn(String label, IconData icon, VoidCallback onPressed,
      {bool isDestructive = false}) {
    final style = isDestructive
        ? FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
            foregroundColor: Theme.of(context).colorScheme.onError,
          )
        : null;
    return FilledButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: style,
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 13,
                )),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14))),
        ],
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
