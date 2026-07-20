import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/offline/sync_service.dart';
import '../../core/widgets/app_scaffold.dart';
import '../../core/widgets/empty_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/loading_view.dart';
import '../../l10n/app_localizations.dart';
import '../../config/mobile_routes.dart';

class DashboardScreen extends StatefulWidget {
  final AuthProvider auth;
  final SyncService sync;
  final ApiClient api;

  const DashboardScreen({
    super.key,
    required this.auth,
    required this.sync,
    required this.api,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() => _loading = true);
    try {
      final machineSummary = await widget.api.get('/maintenance/summary/machines');
      final requestSummary = await widget.api.get('/maintenance/summary/requests');
      setState(() {
        _summary = {
          'machines': machineSummary,
          'requests': requestSummary,
        };
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

    return AppScaffold(
      currentIndex: 0,
      body: RefreshIndicator(
        onRefresh: _loadSummary,
        child: _buildBody(t, theme),
      ),
    );
  }

  Widget _buildBody(AppLocalizations t, ThemeData theme) {
    if (_loading) return const LoadingView();
    if (_error != null) {
      return ErrorView(message: _error!, onRetry: _loadSummary);
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildHeader(t, theme),
        const SizedBox(height: 24),
        _buildKpiRow(t, theme),
        const SizedBox(height: 24),
        _buildQuickLinks(t, theme),
        const SizedBox(height: 24),
        _buildUserInfo(t, theme),
      ],
    );
  }

  Widget _buildHeader(AppLocalizations t, ThemeData theme) {
    final user = widget.auth.user;
    return Row(
      children: [
        CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Text(
            user?.name.isNotEmpty == true
                ? user!.name[0].toUpperCase()
                : 'U',
            style: TextStyle(
              color: theme.colorScheme.onPrimaryContainer,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t.isArabic ? 'مرحباً' : 'Hello',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              Text(
                user?.name ?? 'User',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.settings_outlined),
          onPressed: () => Navigator.pushNamed(context, MobileRoutes.settings),
        ),
      ],
    );
  }

  Widget _buildKpiRow(AppLocalizations t, ThemeData theme) {
    return SizedBox(
      height: 100,
      child: Row(
        children: [
          _kpiCard(
            theme,
            Icons.precision_manufacturing,
            t.totalMachines,
            '${_summary?['machines']?['total'] ?? 0}',
            Colors.blue,
          ),
          const SizedBox(width: 12),
          _kpiCard(
            theme,
            Icons.build_outlined,
            t.openRequests,
            '${_summary?['requests']?['open'] ?? 0}',
            Colors.orange,
          ),
          const SizedBox(width: 12),
          _kpiCard(
            theme,
            Icons.notifications_outlined,
            t.unreadNotifications,
            '0',
            Colors.red,
          ),
        ],
      ),
    );
  }

  Widget _kpiCard(
      ThemeData theme, IconData icon, String label, String value, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 4),
              Text(value,
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold)),
              Text(label,
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickLinks(AppLocalizations t, ThemeData theme) {
    final links = [
      _LinkData(Icons.qr_code_scanner, t.scanBarcode, MobileRoutes.scanner),
      _LinkData(Icons.precision_manufacturing_outlined, t.machines,
          MobileRoutes.machines),
      _LinkData(Icons.build_outlined, t.maintenance,
          MobileRoutes.maintenanceRequests),
      _LinkData(Icons.inventory_2_outlined, t.inventory, MobileRoutes.inventory),
      _LinkData(Icons.notifications_outlined, t.notifications,
          MobileRoutes.notifications),
      _LinkData(Icons.profile_outlined, t.myProfile, MobileRoutes.profile),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t.quickLinks,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: ResponsiveBuilder.isTablet(context) ? 4 : 3,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1,
          ),
          itemCount: links.length,
          itemBuilder: (_, i) => Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => Navigator.pushNamed(context, links[i].route),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(links[i].icon, color: theme.colorScheme.primary),
                  const SizedBox(height: 8),
                  Text(links[i].label,
                      style: theme.textTheme.labelSmall,
                      textAlign: TextAlign.center,
                      maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildUserInfo(AppLocalizations t, ThemeData theme) {
    final user = widget.auth.user;
    if (user == null) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.myProfile,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _infoRow(theme, Icons.person_outlined, user.name),
            _infoRow(theme, Icons.email_outlined, user.email),
            if (user.phone != null)
              _infoRow(theme, Icons.phone_outlined, user.phone!),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(ThemeData theme, IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Text(text),
        ],
      ),
    );
  }
}

class _LinkData {
  final IconData icon;
  final String label;
  final String route;
  _LinkData(this.icon, this.label, this.route);
}
