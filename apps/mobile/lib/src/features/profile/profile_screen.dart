import 'package:flutter/material.dart';
import '../../core/auth/auth_provider.dart';
import '../../l10n/app_localizations.dart';
import '../../config/mobile_routes.dart';

class ProfileScreen extends StatefulWidget {
  final AuthProvider auth;

  const ProfileScreen({super.key, required this.auth});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final user = widget.auth.user;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.myProfile),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () =>
                Navigator.pushNamed(context, MobileRoutes.settings),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: theme.colorScheme.primaryContainer,
                    child: Text(
                      user?.name.isNotEmpty == true
                          ? user!.name[0].toUpperCase()
                          : 'U',
                      style: TextStyle(
                        fontSize: 32,
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(user?.name ?? 'User',
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  Text(user?.email ?? '',
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                _menuItem(theme, Icons.person_outlined, t.myProfile, () {}),
                const Divider(height: 1, indent: 56),
                _menuItem(
                    theme, Icons.shield_outlined, t.myPermissions, () {}),
                const Divider(height: 1, indent: 56),
                _menuItem(theme, Icons.sync, t.sync,
                    () => Navigator.pushNamed(context, MobileRoutes.syncQueue)),
                const Divider(height: 1, indent: 56),
                _menuItem(theme, Icons.settings_outlined, t.settingsTitle,
                    () => Navigator.pushNamed(context, MobileRoutes.settings)),
                const Divider(height: 1, indent: 56),
                _menuItem(theme, Icons.logout, t.logout, () => _logout(t),
                    isDestructive: true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (widget.auth.permissions != null) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.myPermissions,
                        style: theme.textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    ...widget.auth.permissions!.roles.map((r) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Chip(
                            label: Text('${r.name} (${r.code})',
                                style: const TextStyle(fontSize: 12)),
                            side: BorderSide.none,
                            visualDensity: VisualDensity.compact,
                          ),
                        )),
                    if (widget.auth.permissions!.isSuperAdmin)
                      Chip(
                        label: const Text('Super Admin',
                            style: TextStyle(fontSize: 12)),
                        backgroundColor: Colors.amber.withAlpha(30),
                        side: BorderSide.none,
                        visualDensity: VisualDensity.compact,
                      ),
                    const SizedBox(height: 8),
                    Text('${widget.auth.permissions!.permissions.length} permissions',
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _menuItem(ThemeData theme, IconData icon, String label,
      VoidCallback onPressed,
      {bool isDestructive = false}) {
    final color =
        isDestructive ? theme.colorScheme.error : theme.colorScheme.onSurface;
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(label, style: TextStyle(color: color)),
      trailing: isDestructive ? null : const Icon(Icons.chevron_right),
      onTap: onPressed,
    );
  }

  void _logout(AppLocalizations t) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.confirm),
        content: Text(t.logout),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(t.cancel)),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              widget.auth.logout();
            },
            child: Text(t.logout),
          ),
        ],
      ),
    );
  }
}
