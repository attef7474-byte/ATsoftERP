# Architecture risk register

| Area | Current risk | Refactor direction |
| --- | --- | --- |
| CRUD forms | Response-shape drift and partial-row edits | Shared normalization and detail-first CRUD hook |
| Admin types | Large shared type file | Domain modules with compatibility barrel |
| Admin UI | Large shared component file | One component per module with compatibility barrel |
| Data grid | Overlay and action behavior coupled to table rendering | Stable public component with internal modules |
| Admin shell | Navigation, layout, and interaction coupled | Stable shell with focused layout modules |
| i18n | Large locale objects and merge-conflict exposure | Namespace modules composed into identical locale objects |
| Reports | Many report domains and exports in one service | Controller-compatible orchestrator and domain services |

Rejected business domains remain inactive throughout this closure.
