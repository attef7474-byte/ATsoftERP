import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/offline/sync_service.dart';
import '../../l10n/app_localizations.dart';

class InventoryLineEntryScreen extends StatefulWidget {
  final ApiClient api;
  final SyncService sync;

  const InventoryLineEntryScreen({
    super.key,
    required this.api,
    required this.sync,
  });

  @override
  State<InventoryLineEntryScreen> createState() =>
      _InventoryLineEntryScreenState();
}

class _InventoryLineEntryScreenState extends State<InventoryLineEntryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _productCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _productCtrl.dispose();
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  String? get _countId =>
      ModalRoute.of(context)?.settings.arguments as String?;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_countId == null) return;
    setState(() => _saving = true);

    final body = <String, dynamic>{
      'productId': _productCtrl.text.trim(),
      if (_qtyCtrl.text.isNotEmpty)
        'systemQty': double.tryParse(_qtyCtrl.text),
      if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text.trim(),
    };

    try {
      await widget.api
          .post('/inventory/counts/$_countId/lines', body: body);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      await widget.sync.enqueueInventoryCountLine(
        countId: _countId!,
        productId: _productCtrl.text.trim(),
        countedQty: double.tryParse(_qtyCtrl.text),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved offline. Will sync later.')),
        );
        Navigator.of(context).pop(true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Add Line Item')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _productCtrl,
              decoration: const InputDecoration(labelText: 'Product ID'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _qtyCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'System Qty',
                hintText: 'Optional',
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _notesCtrl,
              decoration: InputDecoration(labelText: t.notes),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48)),
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Add Line'),
            ),
          ],
        ),
      ),
    );
  }
}
