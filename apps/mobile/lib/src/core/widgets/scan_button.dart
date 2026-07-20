import 'package:flutter/material.dart';

class ScanFAB extends StatelessWidget {
  final VoidCallback onPressed;

  const ScanFAB({super.key, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.large(
      onPressed: onPressed,
      backgroundColor: Theme.of(context).colorScheme.primary,
      foregroundColor: Theme.of(context).colorScheme.onPrimary,
      child: const Icon(Icons.qr_code_scanner, size: 32),
    );
  }
}
