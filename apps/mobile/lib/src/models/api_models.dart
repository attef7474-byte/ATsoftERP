class User {
  final String id;
  final String email;
  final String name;
  final String? phone;
  final String? avatar;
  final String? companyId;
  final String? branchId;
  final String? departmentId;
  final String? status;
  final String? lastLoginAt;
  final String createdAt;
  final List<UserRole> roles;

  User({
    required this.id,
    required this.email,
    required this.name,
    this.phone,
    this.avatar,
    this.companyId,
    this.branchId,
    this.departmentId,
    this.status,
    this.lastLoginAt,
    required this.createdAt,
    this.roles = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String?,
        avatar: json['avatar'] as String?,
        companyId: json['companyId'] as String?,
        branchId: json['branchId'] as String?,
        departmentId: json['departmentId'] as String?,
        status: json['status'] as String?,
        lastLoginAt: json['lastLoginAt'] as String?,
        createdAt: json['createdAt'] as String,
        roles: (json['roles'] as List<dynamic>?)
                ?.map((e) => UserRole.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class UserRole {
  final Role role;

  UserRole({required this.role});

  factory UserRole.fromJson(Map<String, dynamic> json) => UserRole(
        role: Role.fromJson(json['role'] as Map<String, dynamic>),
      );
}

class Role {
  final String id;
  final String code;
  final String name;
  final List<RolePermission> permissions;

  Role({
    required this.id,
    required this.code,
    required this.name,
    this.permissions = const [],
  });

  factory Role.fromJson(Map<String, dynamic> json) => Role(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        permissions: (json['permissions'] as List<dynamic>?)
                ?.map(
                    (e) => RolePermission.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class RolePermission {
  final Permission permission;

  RolePermission({required this.permission});

  factory RolePermission.fromJson(Map<String, dynamic> json) =>
      RolePermission(
        permission: Permission.fromJson(json['permission'] as Map<String, dynamic>),
      );
}

class Permission {
  final String id;
  final String key;
  final String name;

  Permission({
    required this.id,
    required this.key,
    required this.name,
  });

  factory Permission.fromJson(Map<String, dynamic> json) => Permission(
        id: json['id'] as String,
        key: json['key'] as String,
        name: json['name'] as String,
      );
}

class UserPermissions {
  final List<RoleInfo> roles;
  final List<String> permissions;
  final bool isSuperAdmin;

  UserPermissions({
    this.roles = const [],
    this.permissions = const [],
    this.isSuperAdmin = false,
  });

  factory UserPermissions.fromJson(Map<String, dynamic> json) =>
      UserPermissions(
        roles: (json['roles'] as List<dynamic>?)
                ?.map((e) => RoleInfo.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        permissions: (json['permissions'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        isSuperAdmin: json['isSuperAdmin'] as bool? ?? false,
      );

  bool hasPermission(String key) =>
      isSuperAdmin || permissions.contains(key);
}

class RoleInfo {
  final String id;
  final String code;
  final String name;

  RoleInfo({required this.id, required this.code, required this.name});

  factory RoleInfo.fromJson(Map<String, dynamic> json) => RoleInfo(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
      );
}

class LoginRequest {
  final String email;
  final String password;

  LoginRequest({required this.email, required this.password});

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
      };
}

class LoginResponse {
  final String accessToken;
  final User user;

  LoginResponse({required this.accessToken, required this.user});

  factory LoginResponse.fromJson(Map<String, dynamic> json) => LoginResponse(
        accessToken: json['accessToken'] as String,
        user: User.fromJson(json['user'] as Map<String, dynamic>),
      );
}

class Machine {
  final String id;
  final String code;
  final String name;
  final String? status;
  final String? categoryId;
  final String? model;
  final String? serialNumber;
  final String? manufacturer;
  final String? location;
  final String? createdAt;

  Machine({
    required this.id,
    required this.code,
    required this.name,
    this.status,
    this.categoryId,
    this.model,
    this.serialNumber,
    this.manufacturer,
    this.location,
    this.createdAt,
  });

  factory Machine.fromJson(Map<String, dynamic> json) => Machine(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        status: json['status'] as String?,
        categoryId: json['categoryId'] as String?,
        model: json['model'] as String?,
        serialNumber: json['serialNumber'] as String?,
        manufacturer: json['manufacturer'] as String?,
        location: json['location'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class MaintenanceRequest {
  final String id;
  final String machineId;
  final String? machineName;
  final String title;
  final String? description;
  final String? type;
  final String? priority;
  final String? status;
  final String? assignedToId;
  final String? requestedById;
  final String? notes;
  final String? createdAt;

  MaintenanceRequest({
    required this.id,
    required this.machineId,
    this.machineName,
    required this.title,
    this.description,
    this.type,
    this.priority,
    this.status,
    this.assignedToId,
    this.requestedById,
    this.notes,
    this.createdAt,
  });

  factory MaintenanceRequest.fromJson(Map<String, dynamic> json) =>
      MaintenanceRequest(
        id: json['id'] as String,
        machineId: json['machineId'] as String,
        machineName: json['machineName'] as String?,
        title: json['title'] as String,
        description: json['description'] as String?,
        type: json['type'] as String?,
        priority: json['priority'] as String?,
        status: json['status'] as String?,
        assignedToId: json['assignedToId'] as String?,
        requestedById: json['requestedById'] as String?,
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class InventoryCount {
  final String id;
  final String warehouseId;
  final String? warehouseName;
  final String? status;
  final String? notes;
  final String? createdAt;
  final int? lineCount;

  InventoryCount({
    required this.id,
    required this.warehouseId,
    this.warehouseName,
    this.status,
    this.notes,
    this.createdAt,
    this.lineCount,
  });

  factory InventoryCount.fromJson(Map<String, dynamic> json) =>
      InventoryCount(
        id: json['id'] as String,
        warehouseId: json['warehouseId'] as String,
        warehouseName: json['warehouseName'] as String?,
        status: json['status'] as String?,
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] as String?,
        lineCount: json['lineCount'] as int?,
      );
}

class InventoryCountLine {
  final String id;
  final String productId;
  final String? productName;
  final String? productCode;
  final double? systemQty;
  final double? countedQty;
  final String? notes;
  final String? status;

  InventoryCountLine({
    required this.id,
    required this.productId,
    this.productName,
    this.productCode,
    this.systemQty,
    this.countedQty,
    this.notes,
    this.status,
  });

  factory InventoryCountLine.fromJson(Map<String, dynamic> json) =>
      InventoryCountLine(
        id: json['id'] as String,
        productId: json['productId'] as String,
        productName: json['productName'] as String?,
        productCode: json['productCode'] as String?,
        systemQty: (json['systemQty'] as num?)?.toDouble(),
        countedQty: (json['countedQty'] as num?)?.toDouble(),
        notes: json['notes'] as String?,
        status: json['status'] as String?,
      );
}

class Product {
  final String id;
  final String code;
  final String name;
  final String? description;
  final String? categoryId;
  final String? unit;
  final String? barcode;
  final double? minStock;
  final double? maxStock;
  final String? status;

  Product({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    this.categoryId,
    this.unit,
    this.barcode,
    this.minStock,
    this.maxStock,
    this.status,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        code: json['code'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        categoryId: json['categoryId'] as String?,
        unit: json['unit'] as String?,
        barcode: json['barcode'] as String?,
        minStock: (json['minStock'] as num?)?.toDouble(),
        maxStock: (json['maxStock'] as num?)?.toDouble(),
        status: json['status'] as String?,
      );
}

class NotificationItem {
  final String id;
  final String title;
  final String message;
  final String? type;
  final String? link;
  final bool read;
  final String createdAt;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    this.type,
    this.link,
    this.read = false,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) =>
      NotificationItem(
        id: json['id'] as String,
        title: json['title'] as String,
        message: json['message'] as String,
        type: json['type'] as String?,
        link: json['link'] as String?,
        read: json['read'] as bool? ?? false,
        createdAt: json['createdAt'] as String,
      );
}

class ScanEvent {
  final String id;
  final String scannedValue;
  final String? purpose;
  final String? result;
  final String? entityType;
  final String? entityId;
  final String createdAt;

  ScanEvent({
    required this.id,
    required this.scannedValue,
    this.purpose,
    this.result,
    this.entityType,
    this.entityId,
    required this.createdAt,
  });

  factory ScanEvent.fromJson(Map<String, dynamic> json) => ScanEvent(
        id: json['id'] as String,
        scannedValue: json['scannedValue'] as String,
        purpose: json['purpose'] as String?,
        result: json['result'] as String?,
        entityType: json['entityType'] as String?,
        entityId: json['entityId'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

class PaginatedResponse<T> {
  final List<T> data;
  final int total;
  final int page;
  final int limit;

  PaginatedResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
  });

  bool get hasMore => page * limit < total;
}
