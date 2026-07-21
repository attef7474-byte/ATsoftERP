# Runtime Proof

## Validation Builds
| Check | Result |
|-------|:------:|
| prisma validate | PASS |
| prisma generate | PASS |
| build:api | PASS |
| typecheck | PASS |
| build:web | PASS |
| i18n:check | PASS (2109 keys) |

## Note
Full API runtime proof (creating records and verifying generated codes
via HTTP) requires the API and Web servers to be running in separate
terminals. This CLI environment cannot persist server processes across
tool invocations. Manual runtime testing is required.
