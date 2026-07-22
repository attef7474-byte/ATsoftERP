# Field Mapping Report

## Response Interceptor
All API responses wrapped in `{ success: true, data: <entity> }` by `ResponseInterceptor`.

## Mapping Pattern

**Before (broken):**
```tsx
const res = await api.get<Entity>(`/entities/${id}`);
// res = { success: true, data: Entity }
setCode(res.code);   // undefined - res.code doesn't exist
```

**After (fixed):**
```tsx
const res = await api.get<any>(`/entities/${id}`);
const detail = res.data as Entity;
setCode(detail.code);  // correct value
```

For inline edit modals:
```tsx
const openEdit = async (item) => {
  setDetailLoading(true);
  setModalOpen(true);
  const res = await api.get<any>(`/entities/${item.id}`);
  const detail = res.data;
  setForm({ field: detail.field ?? '' });
  setDetailLoading(false);
};
```
