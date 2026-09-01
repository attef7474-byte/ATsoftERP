export const PRODUCTION_EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // production-unit (Phase 1.1 master data)
  { key: "production-unit:create", module: "production-unit", action: "create" },
  { key: "production-unit:read", module: "production-unit", action: "read" },
  { key: "production-unit:update", module: "production-unit", action: "update" },
  { key: "production-unit:delete", module: "production-unit", action: "delete" },
  { key: "production-unit:activate", module: "production-unit", action: "activate" },
  { key: "production-unit:deactivate", module: "production-unit", action: "deactivate" },
  // production-product (production product definition, Phase 1.1 master data)
  { key: "production-product:create", module: "production-product", action: "create" },
  { key: "production-product:read", module: "production-product", action: "read" },
  { key: "production-product:update", module: "production-product", action: "update" },
  { key: "production-product:delete", module: "production-product", action: "delete" },
  { key: "production-product:activate", module: "production-product", action: "activate" },
  { key: "production-product:deactivate", module: "production-product", action: "deactivate" },
  // VAL-R1G-A: production valuation close
  { key: "production-run:close-valuation", module: "production-run", action: "close-valuation" },
];
