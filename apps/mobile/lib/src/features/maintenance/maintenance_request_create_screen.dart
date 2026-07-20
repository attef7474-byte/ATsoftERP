import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/offline/sync_service.dart';
import '../../l10n/app_localizations.dart';

class MaintenanceRequestCreateScreen extends StatefulWidget {
  final ApiClient api;
  final SyncService sync;

  const MaintenanceRequestCreateScreen({
    super.key,
    required this.api,
    required this.sync,
  });

  @override
  State<MaintenanceRequestCreateScreen> createState() =>
      _MaintenanceRequestCreateScreenState();
}

class _MaintenanceRequestCreateScreenState
    extends State<MaintenanceRequestCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _machineIdCtrl = TextEditingController();
  String _type = 'CORRECTIVE';
  String _priority = 'MEDIUM';
  bool _saving = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _notesCtrl.dispose();
    _machineIdCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    try {
      await widget.api.post('/maintenance/requests', body: {
        'machineId': _machineIdCtrl.text.trim(),
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'type': _type,
        'priority': _priority,
        'notes': _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      await widget.sync.enqueueMaintenanceRequest(
        machineId: _machineIdCtrl.text.trim(),
        title: _titleCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        type: _type,
        priority: _priority,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Saved offline. Will sync later.')),
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
      appBar: AppBar(title: Text(t.createRequest)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _machineIdCtrl,
              decoration: InputDecoration(labelText: 'Machine ID'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _titleCtrl,
              decoration: InputDecoration(labelText: t.title),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descCtrl,
              decoration: InputDecoration(labelText: t.description),
              maxLines: 3,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _type,
              decoration: InputDecoration(labelText: t.type),
              items: const [
                DropdownMenuItem(value: 'CORRECTIVE', child: Text('Corrective')),
                DropdownMenuItem(value: 'PREVENTIVE', child: Text('Preventive')),
                DropdownMenuItem(value: 'INSPECTION', child: Text('Inspection')),
              ],
              onChanged: (v) => setState(() => _type = v!),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _priority,
              decoration: InputDecoration(labelText: t.priority),
              items: const [
                DropdownMenuItem(value: 'LOW', child: Text('Low')),
                DropdownMenuItem(value: 'MEDIUM', child: Text('Medium')),
                DropdownMenuItem(value: 'HIGH', child: Text('High')),
                DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
              ],
              onChanged: (v) => setState(() => _priority = v!),
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
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              child: _saving
                  ? const SizedBox(
                      height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(t.submit),
            ),
          ],
        ),
      ),
    );
  }
}
