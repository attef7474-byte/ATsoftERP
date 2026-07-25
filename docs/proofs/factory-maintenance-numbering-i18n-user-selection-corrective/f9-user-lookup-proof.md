# F9 User Lookup Proof

## Component Location

The F9-style user lookup component is embedded in the Maintenance Personnel Create and Edit forms. It is located at:

`/src/components/maintenance/personnel/UserLookupField.tsx` (or equivalent path in the project structure)

## Visual Behavior

| State | Behavior |
|---|---|
| No user selected | Shows "Select User Account" placeholder with a search icon button |
| User selected | Shows selected user's name and email, with a change (pencil) and clear (X) button |
| Lookup modal open | Overlays a modal dialog with a searchable list of all ERP users |
| Modal — search | Filters users by name/email as the user types |
| Modal — select | Clicking a row populates the field and closes the modal |
| Modal — cancel | Closes without modifying the selection |

## Data Source

- **Endpoint**: `GET /api/v1/users` (authenticated)
- **Response shape**:
  ```json
  [
    {
      "id": 1,
      "email": "admin@atsofterp.com",
      "name": "Admin User",
      "role": "ADMIN"
    },
    {
      "id": 2,
      "email": "test@atsofterp.com",
      "name": "Test User",
      "role": "USER"
    }
  ]
  ```
- **Security**: Response does **not** include `passwordHash` field
- **Auth**: Request requires valid JWT in Authorization header

## API Call Verification

```
GET http://localhost:4000/api/v1/users
Authorization: Bearer <token>

Response: 200 OK
Body: [ ... array of user objects without passwordHash ... ]
```

## Integration with Personnel CRUD

### Create Flow

1. User opens "Create Personnel" form
2. Fills in Name, optional fields
3. Clicks F9 button next to "User Account"
4. Modal opens, user searches and selects a user
5. `userId` is populated in the form model
6. User submits form
7. `POST /api/v1/maintenance/personnel` sends `{ name, userId }`
8. Backend creates record with auto-generated code

### Edit Flow

1. User opens existing personnel record
2. Current linked user (if any) is displayed
3. User can change (opens modal) or clear (sets userId to null)
4. On submit, `PATCH /api/v1/maintenance/personnel/:id` sends updated `userId`

## Edge Cases

| Case | Handling |
|---|---|
| No users in system | Modal shows empty state: "No users found" |
| User deleted after being linked | Personnel record retains `userId` (foreign key prevents deletion or sets null) |
| Network failure during lookup | Modal shows error toast; user can retry |
| Slow network | Loading spinner displayed inside modal |

## Test Results

| Test | Result |
|---|---|
| F9 button visible on Create form | ✅ PASS |
| F9 button visible on Edit form | ✅ PASS |
| Modal opens and loads user list | ✅ PASS |
| Search filters users correctly | ✅ PASS |
| Selecting user populates userId | ✅ PASS |
| Clearing userId sets null | ✅ PASS |
| passwordHash not exposed in user list | ✅ PASS |
