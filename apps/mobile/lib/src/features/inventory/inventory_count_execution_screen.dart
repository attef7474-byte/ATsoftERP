import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/offline/sync_service.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';

class InventoryCountExecutionScreen extends StatefulWidget {
  final ApiClient api;
  final SyncService sync;

  const InventoryCountExecutionScreen({
    super.key,
    required this.api,
    required this.sync,
  });

  @override
  State<InventoryCountExecutionScreen> createState() =>
      _InventoryCountExecutionScreenState();
}

class _InventoryCountExecutionScreenState
    extends State<InventoryCountExecutionScreen> {
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

  Future<void> _recordCount(String lineId, double qty) async {
    try {
      await widget.api.patch(
        '/inventory/count-lines/$lineId/count',
        body: {'countedQty': qty},
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

    return Scaffold(
      appBar: AppBar(title: Text('${t.countInProgress}: ${_count?.warehouseName ?? ""}')),
      body: _buildBody(t),
    );
  }

  Widget _buildBody(AppLocalizations t) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_count == null) return const SizedBox.shrink();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('${_lines.length} lines',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          ..._lines.map((line) => _CountLineCard(
                line: line,
                onCount: (qty) => _recordCount(line.id, qty),
              )),
        ],
      ),
    );
  }
}

class _CountLineCard extends StatelessWidget {
  final InventoryCountLine line;
  final ValueChanged<double> onCount;

  const _CountLineCard({required this.line, required this.onCount});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final qtyCtrl = TextEditingController(
      text: line.countedQty?.toStringAsFixed(1) ?? '',
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(line.productName ?? line.productId,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('System: ${line.systemQty ?? 0}',
                style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: qtyCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Counted',
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () {
                    final qty = double.tryParse(qtyCtrl.text);
                    if (qty != null) onCount(qty);
                  },
                  child: const Text('Record'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
