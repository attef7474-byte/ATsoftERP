import 'package:flutter/material.dart';
import '../../core/auth/auth_provider.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/localizations_provider.dart';
import '../../config/mobile_routes.dart';

class SettingsScreen extends StatefulWidget {
  final LocaleProvider localeProvider;
  final AuthProvider auth;

  const SettingsScreen({
    super.key,
    required this.localeProvider,
    required this.auth,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _darkMode = false;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(t.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: Text(t.darkMode),
                  subtitle: Text(t.appearance),
                  secondary: const Icon(Icons.dark_mode_outlined),
                  value: _darkMode,
                  onChanged: (v) => setState(() => _darkMode = v),
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.language_outlined),
                  title: Text(t.language),
                  subtitle: Text(widget.localeProvider.isArabic
                      ? 'العربية'
                      : 'English'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => widget.localeProvider.toggleLanguage(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.sync),
                  title: Text(t.sync),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () =>
                      Navigator.pushNamed(context, MobileRoutes.syncQueue),
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.person_outlined),
                  title: Text(t.myProfile),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () =>
                      Navigator.pushNamed(context, MobileRoutes.profile),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.info_outline),
              title: Text(t.about),
              subtitle: Text('${t.appName} ${t.version} 1.0.0'),
            ),
          ),
        ],
      ),
    );
  }
}
