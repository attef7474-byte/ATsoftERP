# Checklist Workflow Proof

## Workflow States

Checklist Execution: IN_PROGRESS → COMPLETED

Checklist Execution Item: PENDING → COMPLETED (with passed=true/false/null)

## Transitions

1. Create execution → status=IN_PROGRESS, items=PENDING
2. Update item to OK → status=COMPLETED, passed=true
3. Update item to NOT_OK → status=COMPLETED, passed=false
4. Update item to NA → status=COMPLETED, passed=null
5. Update item notes → notes field updated
6. Complete execution → status=COMPLETED, completedAt set
   - Blocks if mandatory items are still PENDING
   - Allows completion if only optional items are PENDING

## Request Integration
- Request complete checks for IN_PROGRESS executions with pending mandatory items
- If found, blocks completion
- After all checklists completed, request completion proceeds normally
