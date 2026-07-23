# i18n Proof — Batch D: Machine Components

## English Keys Added (`en/maintenance.ts`)

```typescript
machineComponents: 'Machine Components',
machineComponent: 'Machine Component',
newMachineComponent: 'New Machine Component',
editMachineComponent: 'Edit Machine Component',
componentType: 'Component Type',
criticality: 'Criticality',
locationInMachine: 'Location in Machine',
parentComponent: 'Parent Component',
components: {
    form: {
        code: 'Code',
        name: 'Name',
        description: 'Description',
        componentType: 'Component Type',
        criticality: 'Criticality',
        locationInMachine: 'Location in Machine',
        manufacturer: 'Manufacturer',
        model: 'Model',
        serialNumber: 'Serial Number',
        parentComponent: 'Parent Component',
    },
},
```

## Arabic Keys Added (`ar/maintenance.ts`)

```typescript
machineComponents: 'مكونات الماكينة',
machineComponent: 'مكون ماكينة',
newMachineComponent: 'مكون جديد',
editMachineComponent: 'تعديل المكون',
componentType: 'نوع المكون',
criticality: 'الأهمية',
locationInMachine: 'الموقع في الماكينة',
parentComponent: 'المكون الرئيسي',
components: {
    form: {
        code: 'الكود',
        name: 'الاسم',
        description: 'الوصف',
        componentType: 'نوع المكون',
        criticality: 'الأهمية',
        locationInMachine: 'الموقع في الماكينة',
        manufacturer: 'الشركة المصنعة',
        model: 'الموديل',
        serialNumber: 'الرقم التسلسلي',
        parentComponent: 'المكون الرئيسي',
    },
},
```

## Common Keys Added
- `common.selectPlaceholder` — EN: 'Select...', AR: 'اختر...'

## Verification
- Arabic labels verified via Playwright: `مكونات الماكينة`, `نوع المكون`, `الأهمية`, `الموقع في الماكينة`, `المكون الرئيسي`
- English labels verified via Playwright: `Machine Components`, `Component Type`, `Criticality`, `Location in Machine`, `Parent Component`
- No raw i18n key leakage in DOM (verified by Playwright regex scan)
