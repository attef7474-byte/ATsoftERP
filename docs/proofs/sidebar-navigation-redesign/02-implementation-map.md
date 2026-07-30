# Implementation Map

### Sidebar 10-Group Structure

```
1. Dashboard          → dashboard    → /admin/dashboard (direct link)
2. Organization       → organization → sections: orgStructure, operationalData
3. Access Control     → access       → section: usersAndPermissions
4. Assets & Equipment → assets       → sections: assets, technicalStructure
5. Maintenance        → maintenance  → sections: operations, planning, staff, spareParts
6. Inventory          → inventory    → sections: definitions, operations, monitoring
7. Barcode            → barcode      → sections: operations, admin
8. Reports & Analytics→ reports      → sections: main, maintenance rpts, inventory rpts, barcode rpts, system rpts
9. Documents          → documents    → flat items (attachments)
10. System            → system       → sections: settings, logs, communication
```

### Route Group Map (auto-open on navigation)

```
/admin/dashboard/…                               → dashboard
/admin/core/…                                    → organization
/admin/access/…                                  → access
/admin/maintenance/machines, machine-categories… → assets
/admin/maintenance/production-lines, operation…  → organization (operational data)
/admin/maintenance/…                             → maintenance
/admin/installed-parts, spare-part-conditions…   → maintenance
/admin/inventory/…                               → inventory
/admin/barcodes/…                                → barcode
/admin/reports/…                                 → reports
/admin/documents/…                               → documents
/admin/settings, notifications, messaging…       → system
```

### Files Changed

| File | Change Type |
|------|-------------|
| `apps/web/src/components/admin/shell/navigation-data.ts` | Rewrite (types + data) |
| `apps/web/src/components/admin/shell/sidebar.tsx` | Rewrite |
| `apps/web/src/components/admin/shell/admin-shell.tsx` | Major edit |
| `apps/web/src/components/admin/shell/mobile-menu.tsx` | Rewrite |
| `apps/web/src/app/globals.css` | Added ~200 lines |
| `apps/web/src/lib/i18n/locales/en/navigation.ts` | Added keys |
| `apps/web/src/lib/i18n/locales/ar/navigation.ts` | Added keys |
| `apps/web/src/lib/i18n/locales/en/settings.ts` | Added keys |
| `apps/web/src/lib/i18n/locales/ar/settings.ts` | Added keys |
| `apps/web/src/app/admin/settings/appearance/page.tsx` | Added sidebar controls |
