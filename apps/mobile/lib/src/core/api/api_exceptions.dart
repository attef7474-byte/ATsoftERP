class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([String message = 'Session expired'])
      : super(message, statusCode: 401);
}

class NetworkException extends ApiException {
  NetworkException([String message = 'Network error']) : super(message);
}
