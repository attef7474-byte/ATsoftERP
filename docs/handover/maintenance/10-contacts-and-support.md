# Handover Document 10: Contacts & Support

## 1. Development Team

| Role | Contact |
|------|---------|
| Lead Developer | ATsoft ERP Development Team |
| Frontend Developer | ATsoft ERP Development Team |
| Backend Developer | ATsoft ERP Development Team |
| Database Administrator | ATsoft ERP DBA |
| Project Manager | ATsoft ERP Management |

*(Direct contact details are maintained internally by the organization.)*

## 2. Support Procedures

### Bug Reports
- **Platform**: GitHub Issues
- **Required information**:
  - Description of the issue
  - Steps to reproduce
  - Expected vs actual behavior
  - Screenshots (if applicable and permitted)
  - API response (if applicable)
  - Browser/console errors (if applicable)

### Feature Requests
- **Platform**: GitHub Issues (with `enhancement` label)
- **Required information**:
  - Description of the desired feature
  - Use case / business need
  - Proposed implementation (optional)

### Support Response Time
- **Critical issues**: Within 24 hours
- **Non-critical issues**: Within 72 hours
- **Feature requests**: Reviewed within 1 week

## 3. Documentation Locations

| Documentation | Location |
|---------------|----------|
| Project rules & context | `AGENTS.md` (repository root) |
| Architecture & plan | `docs/` |
| Proof documents | `docs/proofs/<batch-slug>/` |
| Handover documents | `docs/handover/maintenance/` |
| SOP documents | `docs/handover/maintenance/sop/` |
| Training documents | `docs/handover/maintenance/training/` |
| Discovery pack | `C:\Users\attef\PycharmProjects\Trae\maintenance-completion-discovery-pack\` |

## 4. Proof Documents Index

Proof documents are located under `docs/proofs/` with batch-specific subdirectories:

| Batch | Directory |
|-------|-----------|
| DX-0 | `docs/proofs/dx-0-module-registry-route-alignment/` |
| I18N-0 | `docs/proofs/i18n-0-api-messages-frontend-cleanup/` |
| NX | `docs/proofs/nx-numbering-centralization/` |
| Z-AA | `docs/proofs/zaa-spare-part-condition-balance/` |
| AB-AC | `docs/proofs/abac-installed-parts-replacement-history/` |
| AD-AE | `docs/proofs/adae-repairable-spareparts-overhaul/` |
| AF-AG | `docs/proofs/afag-maintenance-cost-reports-kpis/` |
| AH-AI | `docs/proofs/ahai-bom-versioning-preventive-planning/` |
| AJ-AK | `docs/proofs/ajak-maintenance-final-audit-sop-training-handover/` |

Each proof directory contains:
- `00-summary.md`
- `01-scope-and-rules.md`
- `02-implementation-map.md`
- `03-api-proof.md`
- `04-browser-dom-proof.md`
- `05-db-integrity-proof.md` (when DB touched)
- `06-i18n-proof.md` (when UI/API messages changed)
- `07-permissions-audit-proof.md` (when permissions/audit changed)
- `08-validation-report.md`
- `09-final-acceptance-report.md`

## 5. Handover Documents Index

All handover documents are at `docs/handover/maintenance/`:

| # | File | Description |
|---|------|-------------|
| 1 | `01-architecture-overview.md` | Maintenance domain architecture |
| 2 | `02-api-reference.md` | API endpoint reference |
| 3 | `03-schema-reference.md` | Database schema reference |
| 4 | `04-frontend-guide.md` | Frontend structure and patterns |
| 5 | `05-configuration-guide.md` | Configuration and settings |
| 6 | `06-deployment-guide.md` | Deployment instructions |
| 7 | `07-troubleshooting-guide.md` | Common issues and solutions |
| 8 | `08-known-limitations.md` | Known limitations and gaps |
| 9 | `09-roadmap.md` | Roadmap and future work |
| 10 | `10-contacts-and-support.md` | Contacts and support procedures |

## 6. SOP Documents

Location: `docs/handover/maintenance/sop/`

*(SOP documents should include step-by-step procedures for:)*
- Creating a maintenance request
- Issuing spare parts
- Processing a repair order
- Running preventive maintenance
- Generating reports

## 7. Training Documents

Location: `docs/handover/maintenance/training/`

*(Training documents should include:)*
- User onboarding guide
- Administrator guide
- Developer onboarding guide
- Common workflows walkthrough

## 8. Important Configuration Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Master project rules, context, and conventions |
| `apps/api/src/app.module.ts` | Module registry — all registered modules |
| `apps/api/prisma/schema.prisma` | Database schema — all models and relations |
| `apps/api/prisma/seed/seed.ts` | Seed data — permissions, numbering, defaults |
| `apps/api/src/numbering/numbering.constants.ts` | Numbering entity type codes |
| `apps/api/src/numbering/numbering.service.ts` | Centralized number generation |
| `apps/web/src/lib/i18n/locales/` | Translation files (EN + AR) |
| `apps/web/src/middleware.ts` | Auth guard for frontend routes |
| `apps/api/.env` | API environment variables |
| `apps/web/.env.local` | Frontend environment variables |

## 9. Emergency Contacts

| Scenario | Contact |
|----------|---------|
| System down / critical bug | System Administrator |
| Data loss / corruption | System Administrator + DBA |
| Security incident | System Administrator + Development Lead |
| Database connectivity | DBA |

**Emergency contact details are maintained internally by the organization and should be shared via secure channels only.**

## 10. Escalation Path for Critical Issues

```
Level 1: System Administrator
  └─ Handles: Access issues, environment issues, user support
     │
Level 2: Development Team Lead
  └─ Handles: Code bugs, data issues, feature requests
     │
Level 3: Project Manager
  └─ Handles: Scope decisions, resource allocation, priority changes
     │
Level 4: ATsoft ERP Management
  └─ Handles: Strategic decisions, budget, release approvals
```

**Critical issue definition**:
- System unavailable or unusable
- Data loss or corruption
- Security breach
- Financial impact (if applicable)
- Regulatory/compliance impact

**Non-critical issue definition**:
- Feature gaps
- UI/UX improvements
- Performance optimizations
- Minor bugs
- Documentation updates
