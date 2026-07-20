class OfflineQueueItem {
  final int? id;
  final String operation;
  final String endpoint;
  final String method;
  final String? body;
  final String createdAt;
  final int retryCount;
  final String status;

  OfflineQueueItem({
    this.id,
    required this.operation,
    required this.endpoint,
    required this.method,
    this.body,
    String? createdAt,
    this.retryCount = 0,
    this.status = 'PENDING',
  }) : createdAt = createdAt ?? DateTime.now().toIso8601String();

  Map<String, dynamic> toMap() => {
        if (id != null) 'id': id,
        'operation': operation,
        'endpoint': endpoint,
        'method': method,
        'body': body,
        'createdAt': createdAt,
        'retryCount': retryCount,
        'status': status,
      };

  factory OfflineQueueItem.fromMap(Map<String, dynamic> map) =>
      OfflineQueueItem(
        id: map['id'] as int?,
        operation: map['operation'] as String,
        endpoint: map['endpoint'] as String,
        method: map['method'] as String,
        body: map['body'] as String?,
        createdAt: map['createdAt'] as String?,
        retryCount: map['retryCount'] as int? ?? 0,
        status: map['status'] as String? ?? 'PENDING',
      );
}
