# Security Proof: User ↔ OperationalPerson Unique Link

## Status: VERIFIED — NO NEW VULNERABILITIES

### Audit
1. **Password hashes**: Never exposed — User model still excludes passwordHash from selects
2. **Tokens/sessions**: Never exposed in personnel responses
3. **Secrets**: Never exposed
4. **Authorization**: All endpoints still use JWT + Permissions guards
5. **Input validation**: CreateMaintenancePersonnelDto uses class-validator decorators
6. **User existence check**: userId is validated against User table before linking
7. **Uniqueness enforcement**:
   - Duplicate `code` → 409 Conflict
   - Duplicate `userId` (non-null) → 409 Conflict (DB-level filtered unique index also enforces)
   - Multiple null `userId` → allowed

### Filtered Unique Index
`UX_operational_people_userId_not_null` ensures at database level that no two OperationalPerson records share the same non-null userId.
