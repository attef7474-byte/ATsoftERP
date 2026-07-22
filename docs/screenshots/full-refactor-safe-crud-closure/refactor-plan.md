# Refactor plan

1. Establish safe API response, form normalization, and CRUD state helpers.
2. Split shared admin types behind the existing import contract.
3. Split shared admin UI components behind the existing import contract.
4. Split the data grid internals without changing its public API.
5. Split the admin shell without changing navigation or access behavior.
6. Split Arabic and English translations while preserving object shape and parity.
7. Split report services while preserving routes, responses, and exports.
8. Clean imports, run the complete ordered validation suite, and capture runtime proof.
