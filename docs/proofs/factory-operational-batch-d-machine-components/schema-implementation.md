# Schema Implementation — Batch D Machine Components

## Prisma Model

### MachineComponent
- `id` — cuid() primary key, `@id @default(cuid())`
- `machineId` — required, foreign key to Machine
- `parentComponentId` — optional, self-referencing foreign key
- `code` — required string
- `name` — required string
- `componentType` — enum: MECHANICAL, ELECTRICAL, CONTROL, PNEUMATIC, HYDRAULIC, HEATING, COOLING, SENSOR, SAFETY, CONVEYOR, FRAME, UTILITY, OTHER
- `description` — optional text
- `locationInMachine` — optional string
- `manufacturer` — optional string
- `model` — optional string
- `serialNumber` — optional string
- `criticality` — enum: LOW, MEDIUM, HIGH, CRITICAL, default MEDIUM
- `status` — string, default ACTIVE
- `createdAt`, `updatedAt`, `deletedAt` — datetimes

### Relations
- `machine` → Machine (required, many-to-one)
- `parentComponent` → MachineComponent (optional, self-referencing)
- `children` → MachineComponent[] (optional, self-referencing inverse)

### Constraints
- `@@unique([machineId, code])` — unique code per machine
- `@@map("machine_components")` — snake_case table name

### Indexes
- `machineId`
- `parentComponentId`
- `status`
- `deletedAt`
- `componentType`

### Machine Model Addition
- `components` → MachineComponent[] relation (inverse)

## DTOs

### CreateMachineComponentDto
- machineId, code, name (required)
- componentType (enum, required)
- criticality (optional, default MEDIUM)
- description, locationInMachine, manufacturer, model, serialNumber, parentComponentId (optional)

### UpdateMachineComponentDto
- Same fields as Create, all optional

## Service Validation
1. Machine existence check
2. Duplicate code check per machine
3. Parent component existence check
4. Parent must belong to same machine
5. Self-parenting blocked
6. Cycle prevention (update guard)
7. Soft delete via deletedAt timestamp
