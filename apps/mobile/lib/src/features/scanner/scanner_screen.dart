import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/offline/sync_service.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../l10n/app_localizations.dart';

class ScannerScreen extends StatefulWidget {
  final ApiClient api;
  final SyncService sync;

  const ScannerScreen({super.key, required this.api, required this.sync});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _manualCtrl = TextEditingController();
  bool _isScanning = false;
  Map<String, dynamic>? _lastResult;
  String? _error;
  String? _selectedPurpose;

  final _purposes = [
    'GENERAL_LOOKUP', 'INVENTORY_COUNTING', 'MAINTENANCE_LOOKUP',
    'MACHINE_CHECK', 'PART_LOOKUP',
  ];

  @override
  void dispose() {
    _manualCtrl.dispose();
    super.dispose();
  }

  Future<void> _processScan(String value) async {
    setState(() {
      _isScanning = true;
      _error = null;
      _lastResult = null;
    });

    try {
      final response = await widget.api.post('/barcodes/scan', body: {
        'value': value,
        if (_selectedPurpose != null) 'purpose': _selectedPurpose,
        'source': 'MOBILE',
      });
      setState(() => _lastResult = response);
    } catch (e) {
      await widget.sync.enqueueScanEvent(
        scannedValue: value,
        purpose: _selectedPurpose,
        note: e.toString(),
      );
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isScanning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    return AppScaffold(
      currentIndex: 1,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(t.scanTitle,
                style: Theme.of(context).textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(t.selectPurpose,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    )),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _selectedPurpose,
              decoration: InputDecoration(labelText: t.type),
              items: _purposes.map((p) {
                final label = _purposeLabel(p, t);
                return DropdownMenuItem(value: p, child: Text(label));
              }).toList(),
              onChanged: (v) => setState(() => _selectedPurpose = v),
            ),
            const SizedBox(height: 24),
            Text(t.manualEntry,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _manualCtrl,
                    decoration: InputDecoration(
                      hintText: t.enterBarcode,
                      prefixIcon: const Icon(Icons.qr_code),
                    ),
                    textInputAction: TextInputAction.go,
                    onSubmitted: (v) {
                      if (v.trim().isNotEmpty) _processScan(v.trim());
                    },
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _isScanning
                      ? null
                      : () {
                          if (_manualCtrl.text.trim().isNotEmpty) {
                            _processScan(_manualCtrl.text.trim());
                          }
                        },
                  child: _isScanning
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(t.scanBarcode),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline,
                          color: Theme.of(context).colorScheme.error),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text(_error!,
                              style: TextStyle(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onErrorContainer))),
                    ],
                  ),
                ),
              ),
            ],
            if (_lastResult != null) ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.scanResult,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ..._lastResult!.entries.map((e) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Text('${e.key}: ${e.value}'),
                          )),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _purposeLabel(String purpose, AppLocalizations t) {
    switch (purpose) {
      case 'GENERAL_LOOKUP':
        return t.generalLookup;
      case 'INVENTORY_COUNTING':
        return t.inventoryCounting;
      case 'MACHINE_CHECK':
        return t.machineCheck;
      case 'PART_LOOKUP':
        return t.partLookup;
      default:
        return purpose;
    }
  }
}
