import 'package:flutter/material.dart';

class ResponsiveBuilder extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final double breakpoint;

  const ResponsiveBuilder({
    super.key,
    required this.mobile,
    this.tablet,
    this.breakpoint = 600,
  });

  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.shortestSide >= 600;

  static bool isLandscape(BuildContext context) =>
      MediaQuery.of(context).orientation == Orientation.landscape;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width >= breakpoint && tablet != null) {
      return tablet!;
    }
    return mobile;
  }
}

class TabletScaffold extends StatelessWidget {
  final Widget? leading;
  final Widget title;
  final List<Widget>? actions;
  final Widget body;
  final Widget? navigationRail;
  final int? selectedIndex;
  final ValueChanged<int>? onDestinationSelected;

  const TabletScaffold({
    super.key,
    this.leading,
    required this.title,
    this.actions,
    required this.body,
    this.navigationRail,
    this.selectedIndex,
    this.onDestinationSelected,
  });

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    return Scaffold(
      appBar: AppBar(
        leading: leading,
        title: title as Widget,
        actions: actions,
      ),
      body: Row(
        children: [
          if (navigationRail != null)
            NavigationRail(
              selectedIndex: selectedIndex ?? 0,
              onDestinationSelected: onDestinationSelected ?? (_) {},
              labelType: isLandscape
                  ? NavigationRailLabelType.none
                  : NavigationRailLabelType.all,
              destinations: (navigationRail as Widget Function(BuildContext))
                      .call(context) as List<NavigationRailDestination>
                  ??
                  [],
            ),
          const VerticalDivider(width: 1),
          Expanded(child: body),
        ],
      ),
    );
  }
}
