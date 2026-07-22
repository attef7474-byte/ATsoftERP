# Data Loss Prevention

1. **Detail fetch before edit**: All inline edit modals now fetch the full record before opening the form. Loading state prevents interaction during fetch.
2. **Error handling**: If detail fetch fails, modal closes and error toast shown. No empty form is presented.
3. **`?? ''` instead of `|| ''`**: Nullish coalescing (`??`) treats `0`, `false`, `''` as valid values, preventing accidental overwrites.
4. **Save blocked before load**: The save button is inside the form section (rendered only after detail loads).
5. **PATCH sends only intended fields**: Original handleSave logic preserved - only sends fields that changed.
