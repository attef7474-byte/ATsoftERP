import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../models/api_models.dart';
import '../api/api_client.dart';
import '../api/api_exceptions.dart';
import 'token_storage.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _api;
  final TokenStorage _storage;

  User? _user;
  UserPermissions? _permissions;
  bool _loading = false;
  String? _error;

  AuthProvider(this._api, this._storage) {
    _tryRestoreSession();
  }

  User? get user => _user;
  UserPermissions? get permissions => _permissions;
  bool get loading => _loading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;

  Future<void> _tryRestoreSession() async {
    final hasToken = await _storage.hasToken();
    if (!hasToken) return;

    final cachedUser = await _storage.getCachedUser();
    if (cachedUser != null) {
      _user = User.fromJson(jsonDecode(cachedUser) as Map<String, dynamic>);
      notifyListeners();
    }

    try {
      await fetchProfile();
    } on UnauthorizedException {
      _user = null;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post('/auth/login', body: {
        'email': email,
        'password': password,
      });

      final loginResp = LoginResponse.fromJson(response);
      await _storage.saveToken(loginResp.accessToken);
      await _storage.cacheUser(jsonEncode(loginResp.user.toJson()));
      _user = loginResp.user;
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
      _user = null;
    } catch (e) {
      _error = e.toString();
      _user = null;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchProfile() async {
    try {
      final response = await _api.get('/auth/me');
      _user = User.fromJson(response);
      await _storage.cacheUser(jsonEncode(response));
      _error = null;
    } on UnauthorizedException {
      await logout();
      rethrow;
    } catch (e) {
      if (_user == null) _error = e.toString();
    }
    notifyListeners();
  }

  Future<void> fetchPermissions() async {
    try {
      final response = await _api.get('/auth/permissions');
      _permissions = UserPermissions.fromJson(response);
    } catch (_) {}
    notifyListeners();
  }

  Future<void> logout() async {
    await _storage.clearToken();
    _user = null;
    _permissions = null;
    notifyListeners();
  }
}
