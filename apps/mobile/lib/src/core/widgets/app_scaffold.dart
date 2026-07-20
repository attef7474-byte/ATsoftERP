import 'package:flutter/material.dart';
import '../../l10n/app_localizations.dart';
import 'responsive_builder.dart';

class AppScaffold extends StatefulWidget {
  final int currentIndex;
  final Widget body;

  const AppScaffold({
    super.key,
    required this.currentIndex,
    required this.body,
  });

  @override
  State<AppScaffold> createState() => _AppScaffoldState();
}

class _Destination {
  final String labelEn;
  final String labelAr;
  final IconData icon;
  final IconData activeIcon;
  final String route;

  const _Destination({
    required this.labelEn,
    required this.labelAr,
    required this.icon,
    required this.activeIcon,
    required this.route,
  });
}

const _destinations = [
  _Destination(
    labelEn: 'Home',
    labelAr: 'الرئيسية',
    icon: Icons.home_outlined,
    activeIcon: Icons.home,
    route: '/dashboard',
  ),
  _Destination(
    labelEn: 'Scanner',
    labelAr: 'الماسح',
    icon: Icons.qr_code_scanner_outlined,
    activeIcon: Icons.qr_code_scanner,
    route: '/scanner',
  ),
  _Destination(
    labelEn: 'Machines',
    labelAr: 'الآلات',
    icon: Icons.precision_manufacturing_outlined,
    activeIcon: Icons.precision_manufacturing,
    route: '/machines',
  ),
  _Destination(
    labelEn: 'Notifications',
    labelAr: 'الإشعارات',
    icon: Icons.notifications_outlined,
    activeIcon: Icons.notifications,
    route: '/notifications',
  ),
];

class _AppScaffoldState extends State<AppScaffold> {
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final isTablet = ResponsiveBuilder.isTablet(context);

    if (isTablet) {
      return _buildTabletLayout(t);
    }
    return _buildPhoneLayout(t);
  }

  Widget _buildPhoneLayout(AppLocalizations t) {
    return Scaffold(
      body: widget.body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.currentIndex,
        onDestinationSelected: (index) {
          if (index != widget.currentIndex) {
            Navigator.of(context).pushReplacementNamed(
              _destinations[index].route,
            );
          }
        },
        destinations: _destinations.map((d) {
          final isSelected = _destinations.indexOf(d) == widget.currentIndex;
          return NavigationDestination(
            icon: Icon(d.icon),
            selectedIcon: Icon(d.activeIcon),
            label: t.isArabic ? d.labelAr : d.labelEn,
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTabletLayout(AppLocalizations t) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: widget.currentIndex,
            onDestinationSelected: (index) {
              if (index != widget.currentIndex) {
                Navigator.of(context).pushReplacementNamed(
                  _destinations[index].route,
                );
              }
            },
            labelType: NavigationRailLabelType.all,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Icon(Icons.factory,
                  size: 32, color: Theme.of(context).colorScheme.primary),
            ),
            destinations: _destinations.map((d) {
              final isSelected =
                  _destinations.indexOf(d) == widget.currentIndex;
              return NavigationRailDestination(
                icon: Icon(d.icon),
                selectedIcon: Icon(d.activeIcon),
                label: Text(t.isArabic ? d.labelAr : d.labelEn),
              );
            }).toList(),
          ),
          const VerticalDivider(width: 1),
          Expanded(child: widget.body),
        ],
      ),
    );
  }
}
