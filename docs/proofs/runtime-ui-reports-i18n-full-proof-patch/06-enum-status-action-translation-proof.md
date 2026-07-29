# 06 — Enum, Status and Action Translation Proof

Central helpers in `apps/web/src/lib/i18n/literals.ts` now provide:

- `translateStatus`
- `translateEnum`
- `translateAuditAction`
- `translateMaintenanceType`
- `translatePriority`
- `translateBarcodeType`
- `translateEntityType`
- `translateUnit`
- `translateMovementType`
- locale-aware date and date-time formatting

Shared status badges and report/data pages reuse these helpers. Audit actions, maintenance types/priorities/statuses, barcode types/entities/statuses, stock movements, units and system statuses no longer require scattered one-off replacements.

The final DOM scan rejects known technical enum values. It passed 36/36 routes. A manual precision check detected `ON TRACK` and `AT RISK` after the first run; `onTrack`/`atRisk` were then added in EN/AR, the web build was repeated, and the full browser run was repeated. Final visible values are `ضمن الوقت` and `معرض للتأخير`.
