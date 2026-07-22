# i18n key parity report

## Split invariant

- Arabic source namespaces assigned: 44 of 44.
- English source namespaces assigned: 44 of 44.
- Namespace file count: 12 Arabic and 12 English, plus one index per locale.
- Arabic and English use the identical namespace-to-file map.
- `common` is composed unconditionally for both locales.
- `grid`, Number Sequences settings, validation, and report namespaces retain
  their original nested keys and values.
- No component received hardcoded Arabic or English text during this phase.
- `i18n-provider.tsx`, locale normalization, persistence, direction handling,
  fallback-to-key behavior, and `useTranslation` were not changed.

The formal repository `npm run i18n:check` result is intentionally deferred
until Phase 7 and global import cleanup are complete, as required by the ordered
execution contract.
