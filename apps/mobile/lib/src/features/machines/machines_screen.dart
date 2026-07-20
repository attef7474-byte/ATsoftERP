import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';
import '../../config/mobile_routes.dart';

class MachinesScreen extends StatefulWidget {
  final ApiClient api;

  const MachinesScreen({super.key, required this.api});

  @override
  State<MachinesScreen> createState() => _MachinesScreenState();
}

class _MachinesScreenState extends State<MachinesScreen> {
  List<Machine> _machines = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({String? search}) async {
    setState(() => _loading = true);
    try {
      final params = <String, String>{};
      if (search != null && search.isNotEmpty) params['search'] = search;
      final response = await widget.api.get('/maintenance/machines',
          queryParams: params.isNotEmpty ? params : null);
      final data = response['data'] as List<dynamic>? ??
          (response.containsKey('machines')
              ? response['machines'] as List<dynamic>
              : <dynamic>[]);
      setState(() {
        _machines = data
            .map((e) => Machine.fromJson(e as Map<String, dynamic>))
            .toList();
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String? status) {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return Colors.green;
      case 'MAINTENANCE':
        return Colors.orange;
      case 'OUT_OF_SERVICE':
        return Colors.red;
      case 'INACTIVE':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    return AppScaffold(
      currentIndex: 2,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: t.search,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          _load();
                        },
                      )
                    : null,
              ),
              onSubmitted: (v) => _load(search: v),
            ),
          ),
          Expanded(
            child: _buildBody(t),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppLocalizations t) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    if (_machines.isEmpty) {
      return const EmptyView(title: 'No machines found');
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _machines.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final m = _machines[i];
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _statusColor(m.status).withAlpha(30),
                child: Icon(Icons.precision_manufacturing,
                    color: _statusColor(m.status)),
              ),
              title: Text(m.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${m.code}${m.model != null ? ' - ${m.model}' : ''}'),
              trailing: Chip(
                label: Text(m.status ?? t.active, style: const TextStyle(fontSize: 11)),
                backgroundColor: _statusColor(m.status).withAlpha(25),
                side: BorderSide.none,
                visualDensity: VisualDensity.compact,
              ),
              onTap: () => Navigator.pushNamed(
                context,
                MobileRoutes.machineDetail,
                arguments: m.id,
              ),
            ),
          );
        },
      ),
    );
  }
}
