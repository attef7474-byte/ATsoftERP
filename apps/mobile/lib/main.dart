import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'src/config/mobile_routes.dart';
import 'src/core/api/api_client.dart';
import 'src/core/api/api_exceptions.dart';
import 'src/core/auth/auth_provider.dart';
import 'src/core/auth/token_storage.dart';
import 'src/core/offline/sync_service.dart';
import 'src/l10n/app_localizations.dart';
import 'src/l10n/localizations_provider.dart';
import 'src/features/auth/login_screen.dart';
import 'src/features/dashboard/dashboard_screen.dart';
import 'src/features/scanner/scanner_screen.dart';
import 'src/features/machines/machines_screen.dart';
import 'src/features/machines/machine_detail_screen.dart';
import 'src/features/machines/maintenance_log_screen.dart';
import 'src/features/maintenance/maintenance_requests_screen.dart';
import 'src/features/maintenance/maintenance_request_create_screen.dart';
import 'src/features/maintenance/maintenance_request_detail_screen.dart';
import 'src/features/inventory/inventory_screen.dart';
import 'src/features/inventory/inventory_count_detail_screen.dart';
import 'src/features/inventory/inventory_count_execution_screen.dart';
import 'src/features/inventory/inventory_line_entry_screen.dart';
import 'src/features/products/product_detail_screen.dart';
import 'src/features/notifications/notifications_screen.dart';
import 'src/features/sync/sync_queue_screen.dart';
import 'src/features/profile/profile_screen.dart';
import 'src/features/settings/settings_screen.dart';
import 'src/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(const MainApp());
}

class MainApp extends StatefulWidget {
  const MainApp({super.key});

  @override
  State<MainApp> createState() => _MainAppState();
}

class _MainAppState extends State<MainApp> {
  final _localeProvider = LocaleProvider();
  late final TokenStorage _tokenStorage;
  late final ApiClient _api;
  late final AuthProvider _auth;
  late final SyncService _sync;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _tokenStorage = TokenStorage();
    _api = ApiClient(_tokenStorage);
    _auth = AuthProvider(_api, _tokenStorage);
    _sync = SyncService(_api);
    _auth.addListener(_onAuthChange);
    _initApp();
  }

  Future<void> _initApp() async {
    _sync.startAutoSync();
    setState(() => _ready = true);
  }

  void _onAuthChange() {
    if (!_auth.isAuthenticated) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => LoginScreen(auth: _auth)),
        (route) => false,
      );
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChange);
    _sync.dispose();
    _api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _localeProvider,
      builder: (context, _) {
        return MaterialApp(
          title: 'ATsoft ERP',
          debugShowCheckedModeBanner: false,
          locale: _localeProvider.locale,
          supportedLocales: const [
            Locale('en'),
            Locale('ar'),
          ],
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          localeResolutionCallback: (locale, supported) {
            if (locale != null) {
              for (final sl in supported) {
                if (sl.languageCode == locale.languageCode) return sl;
              }
            }
            return supported.first;
          },
          theme: _buildTheme(Brightness.light),
          darkTheme: _buildTheme(Brightness.dark),
          themeMode: ThemeMode.light,
          home: _buildHome(),
          onGenerateRoute: (settings) => _buildRoute(settings),
        );
      },
    );
  }

  Widget _buildHome() {
    if (!_ready) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return FutureBuilder<bool>(
      future: _tokenStorage.hasToken(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.data == true && _auth.isAuthenticated) {
          return DashboardScreen(
            auth: _auth,
            sync: _sync,
            api: _api,
          );
        }
        if (snapshot.data == true) {
          _auth.fetchProfile().catchError((_) {});
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return LoginScreen(auth: _auth);
      },
    );
  }

  Route<dynamic>? _buildRoute(RouteSettings settings) {
    final routes = <String, WidgetBuilder>{
      MobileRoutes.login: (_) => LoginScreen(auth: _auth),
      MobileRoutes.dashboard: (_) =>
          DashboardScreen(auth: _auth, sync: _sync, api: _api),
      MobileRoutes.scanner: (_) => ScannerScreen(api: _api, sync: _sync),
      MobileRoutes.machines: (_) => MachinesScreen(api: _api),
      MobileRoutes.machineDetail: (_) =>
          MachineDetailScreen(api: _api),
      MobileRoutes.maintenanceLog: (_) =>
          MaintenanceLogScreen(api: _api),
      MobileRoutes.maintenanceRequests: (_) =>
          MaintenanceRequestsScreen(api: _api, sync: _sync),
      MobileRoutes.maintenanceRequestCreate: (_) =>
          MaintenanceRequestCreateScreen(api: _api, sync: _sync),
      MobileRoutes.maintenanceRequestDetail: (_) =>
          MaintenanceRequestDetailScreen(api: _api),
      MobileRoutes.inventory: (_) =>
          InventoryScreen(api: _api, sync: _sync),
      MobileRoutes.inventoryCountDetail: (_) =>
          InventoryCountDetailScreen(api: _api),
      MobileRoutes.inventoryCountExecution: (_) =>
          InventoryCountExecutionScreen(api: _api, sync: _sync),
      MobileRoutes.inventoryLineEntry: (_) =>
          InventoryLineEntryScreen(api: _api, sync: _sync),
      MobileRoutes.productDetail: (_) =>
          ProductDetailScreen(api: _api),
      MobileRoutes.notifications: (_) =>
          NotificationsScreen(api: _api),
      MobileRoutes.syncQueue: (_) =>
          SyncQueueScreen(sync: _sync),
      MobileRoutes.profile: (_) =>
          ProfileScreen(auth: _auth),
      MobileRoutes.settings: (_) =>
          SettingsScreen(
            localeProvider: _localeProvider,
            auth: _auth,
          ),
    };

    final builder = routes[settings.name];
    if (builder != null) {
      return MaterialPageRoute(builder: builder, settings: settings);
    }
    return null;
  }

  ThemeData _buildTheme(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF1565C0),
      brightness: brightness,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 2,
        backgroundColor: colorScheme.surface,
      ),
    );
  }
}
