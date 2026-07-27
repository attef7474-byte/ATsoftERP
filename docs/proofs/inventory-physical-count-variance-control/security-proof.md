# Security Proof

## Authentication
- All endpoints protected by JwtAuthGuard
- Bearer token required

## Authorization
- Permission-based access control via PermissionsGuard
- 10 new permissions for physical count module:
  - `inventory:physical-count:create`
  - `inventory:physical-count:read`
  - `inventory:physical-count:update`
  - `inventory:physical-count:delete`
  - `inventory:physical-count:submit`
  - `inventory:physical-count:approve`
  - `inventory:physical-count:reject`
  - `inventory:physical-count:post`
  - `inventory:physical-count:cancel`
  - `inventory:physical-count:enter-line`
- Permissions seeded and linked to SUPER_ADMIN role

## Input Validation
- All DTOs use class-validator decorators (@IsString, @IsNumber, @IsOptional, @IsArray, @ValidateNested)
- Swagger decorators for API documentation (@ApiProperty, @ApiPropertyOptional)

## Business Logic Security
- varianceQty always calculated server-side — frontend cannot manipulate variance
- systemQty always read from InventoryBalance — cannot be overwritten
- Status transitions enforced by backend — no direct status manipulation possible
- POST operation validates all preconditions before execution
- Soft delete only — no permanent data loss
