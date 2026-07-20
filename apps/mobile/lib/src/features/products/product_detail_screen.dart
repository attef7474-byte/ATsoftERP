import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../models/api_models.dart';
import '../../l10n/app_localizations.dart';

class ProductDetailScreen extends StatefulWidget {
  final ApiClient api;

  const ProductDetailScreen({super.key, required this.api});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  Product? _product;
  List<Map<String, dynamic>> _balances = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? get _productId =>
      ModalRoute.of(context)?.settings.arguments as String?;

  Future<void> _load() async {
    if (_productId == null) return;
    setState(() => _loading = true);
    try {
      final prodResp = await widget.api.get('/products/$_productId');
      List<Map<String, dynamic>> balances = [];
      try {
        final balResp = await widget.api.get('/products/$_productId/balances');
        final data = balResp['data'] as List<dynamic>? ??
            (balResp.containsKey('balances')
                ? balResp['balances'] as List<dynamic>
                : <dynamic>[]);
        balances = data.cast<Map<String, dynamic>>();
      } catch (_) {}

      setState(() {
        _product = Product.fromJson(prodResp);
        _balances = balances;
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
      appBar: AppBar(title: Text(t.productDetail)),
      body: _buildBody(t, theme),
    );
  }

  Widget _buildBody(AppLocalizations t, ThemeData theme) {
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_product == null) return const SizedBox.shrink();

    final p = _product!;
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
                      child: Icon(Icons.inventory_2,
                          color: theme.colorScheme.onPrimaryContainer),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name,
                              style: theme.textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          Text('${p.code}',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                    if (p.barcode != null)
                      Chip(
                        label: Text(p.barcode!,
                            style: const TextStyle(fontSize: 10)),
                        side: BorderSide.none,
                        visualDensity: VisualDensity.compact,
                      ),
                  ],
                ),
                const Divider(height: 24),
                _row(t.code, p.code),
                _row(t.unit, p.unit ?? '-'),
                if (p.barcode != null) _row(t.barcode, p.barcode!),
                _row(t.minStockLabel, '${p.minStock ?? 0}'),
                _row(t.maxStockLabel, '${p.maxStock ?? 0}'),
                _row(t.status, p.status ?? t.active),
                if (p.description != null && p.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(p.description!),
                ],
              ],
            ),
          ),
        ),
        if (_balances.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(t.productBalances,
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ..._balances.map((b) => Card(
                child: ListTile(
                  title: Text('${b['warehouseName'] ?? b['warehouseId'] ?? ''}'),
                  trailing: Text('${b['quantity'] ?? b['qty'] ?? 0}'),
                ),
              )),
        ],
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 120,
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
