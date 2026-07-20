import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../../config/app_config.dart';
import '../auth/token_storage.dart';
import 'api_exceptions.dart';

class ApiClient {
  final http.Client _client;
  final TokenStorage _tokenStorage;
  bool _isRefreshing = false;

  ApiClient(this._tokenStorage) : _client = http.Client();

  String get baseUrl => AppConfig.apiBaseUrl;

  Map<String, String> _headers(String? token) => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
  }) async {
    final uri = _buildUri(path, queryParams);
    final token = await _tokenStorage.getToken();

    try {
      final response = await _sendRequest(
        method,
        uri,
        body: body,
        headers: _headers(token),
      ).timeout(AppConfig.requestTimeout);

      return _handleResponse(response);
    } on SocketException {
      throw NetworkException('No internet connection');
    } on http.ClientException {
      throw NetworkException('Connection failed');
    }
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
  }) =>
      request('GET', path, queryParams: queryParams);

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) =>
      request('POST', path, body: body);

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
  }) =>
      request('PATCH', path, body: body);

  Future<Map<String, dynamic>> delete(String path) =>
      request('DELETE', path);

  Uri _buildUri(String path, Map<String, String>? queryParams) {
    final uri = Uri.parse('$baseUrl$path');
    if (queryParams != null && queryParams.isNotEmpty) {
      return uri.replace(queryParameters: queryParams);
    }
    return uri;
  }

  Future<http.Response> _sendRequest(
    String method,
    Uri uri, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    switch (method) {
      case 'GET':
        return _client.get(uri, headers: headers);
      case 'POST':
        return _client.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      case 'PATCH':
        return _client.patch(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
      case 'DELETE':
        return _client.delete(uri, headers: headers);
      default:
        throw ApiException('Unsupported method: $method');
    }
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = response.body.isNotEmpty
        ? jsonDecode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body.containsKey('data')) {
        return body;
      }
      return body;
    }

    if (response.statusCode == 401) {
      _tokenStorage.clearToken();
      throw UnauthorizedException(body['message'] as String? ?? 'Session expired');
    }

    final message = body['message'] as String? ??
        body['error'] as String? ??
        'Request failed (${response.statusCode})';
    throw ApiException(message, statusCode: response.statusCode);
  }

  void dispose() {
    _client.close();
  }
}
