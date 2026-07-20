import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';
import '../../config/mobile_routes.dart';

class InventoryCountDetailScreen extends StatefulWidget {
  final ApiClient api;

  const InventoryCountDetailScreen({super.key, required this.api});

  @override
  State<InventoryCountDetailScreen> createState() =>
      _InventoryCountDetailScreenState();
}

class _InventoryCountDetailScreenState
    extends State<InventoryCountDetailScreen> {
  InventoryCount? _count;
  List<InventoryCountLine> _lines = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? get _countId =>
      ModalRoute.of(context)?.settings.arguments as String?;

  Future<void> _load() async {
    if (_countId == null) return;
    setState(() => _loading = true);
    try {
      final countResp = await widget.api.get('/inventory/counts/$_countId');
      final linesResp =
          await widget.api.get('/inventory/counts/$_countId/lines');
      final linesData = linesResp['data'] as List<dynamic>? ??
          (linesResp.containsKey('lines')
              ? linesResp['lines'] as List<dynamic>
              : <dynamic>[]);
      setState(() {
        _count = InventoryCount.fromJson(countResp);
        _lines = linesData
            .map((e) =>
                InventoryCountLine.fromJson(e as Map<String, dynamic>))
            .toList();
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
      await widget.api.patch('/inventory/counts/$_countId/$action');
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
      appBar: AppBar(
        title: Text(t.countDetail),
        actions: [
          if (_count?.status == 'DRAFT')
            IconButton(
              icon: const Icon(Icons.play_arrow),
              tooltip: t.start,
              onPressed: () => _transition('start'),
            ),
          if (_count?.status == 'IN_PROGRESS')
            IconButton(
              icon: const Icon(Icons.check),
              tooltip: t.complete,
              onPressed: () => _transition('complete'),
            ),
        ],
      ),
      body: _buildBody(t, theme),
    );
  }

  Widget _buildBody(AppLocalizations t, ThemeData theme) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_count == null) return const SizedBox.shrink();

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
                      child: Text(t.countDetail,
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.bold)),
                    ),
                    Chip(
                      label: Text(_count!.status ?? '',
                          style: const TextStyle(fontSize: 11)),
                      side: BorderSide.none,
                    ),
                  ],
                ),
                const Divider(height: 16),
                _row(t.warehouse, _count!.warehouseName ?? _count!.warehouseId),
                _row(t.status, _count!.status ?? ''),
                if (_count!.notes != null) _row(t.notes, _count!.notes!),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(t.countLines,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.bold)),
            ),
            if (_count?.status == 'IN_PROGRESS')
              FilledButton.tonalIcon(
                onPressed: () => Navigator.pushNamed(
                  context,
                  MobileRoutes.inventoryLineEntry,
                  arguments: _countId,
                ),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add Line'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (_lines.isEmpty)
          const EmptyView(title: 'No lines yet')
        else
          ..._lines.map((line) => _buildLineCard(line, theme)),
      ],
    );
  }

  Widget _buildLineCard(InventoryCountLine line, ThemeData theme) {
    final diff = (line.countedQty ?? 0) - (line.systemQty ?? 0);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    line.productName ?? line.productId,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                if (line.status != null)
                  Chip(
                    label: Text(line.status!, style: const TextStyle(fontSize: 10)),
                    side: BorderSide.none,
                    visualDensity: VisualDensity.compact,
                    backgroundColor: line.status == 'VERIFIED'
                        ? Colors.green.withAlpha(25)
                        : Colors.orange.withAlpha(25),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _chip('System: ${line.systemQty ?? 0}'),
                const SizedBox(width: 8),
                _chip('Counted: ${line.countedQty ?? 0}'),
                const SizedBox(width: 8),
                _chip('Diff: $diff',
                    color: diff == 0 ? Colors.green : Colors.orange),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: (color ?? Colors.grey).withAlpha(20),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 12, color: color ?? Colors.grey[700])),
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
}
