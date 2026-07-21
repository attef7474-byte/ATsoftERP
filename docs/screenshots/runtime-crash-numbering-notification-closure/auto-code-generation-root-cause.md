# Auto Code Generation Root Cause

## Problem
Creating Company, Branch, Department, and other records did not
automatically generate codes.

## Root Cause
The central NumberingService was never injected or called by any
entity create service. Services either required manual code entry
via DTO or reimplemented numbering logic independently.

## Fix (verified in commit ba9d00d)
- NumberingModule made @Global() for universal injection.
- NumberingService.generateNumberAtomic() made transaction-safe.
- All approved create services now call generateNumberAtomic()
  when code is not provided.
- Frontend code fields removed from create forms.
