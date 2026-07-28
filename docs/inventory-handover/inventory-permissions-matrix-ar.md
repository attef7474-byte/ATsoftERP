# مصفوفة صلاحيات المخزون — العربية

## الصلاحيات المتاحة
| الصلاحية | الوصف |
|---------|--------|
| inventory:reports:* | عرض جميع تقارير المخزون |
| inventory:ledger:read | عرض دفتر الأستاذ |
| inventory:reconciliation:read | عرض التسوية |
| inventory:opening-balance:create | إنشاء رصيد افتتاحي |
| inventory:stock-adjustment:create | إنشاء تسوية مخزون |
| inventory:transfer:create | إنشاء تحويل |
| inventory:operational-receipt:create | إنشاء استلام تشغيلي |
| inventory:physical-count:create | إنشاء جرد فعلي |
| inventory:lock:create | إنشاء قفل |
| inventory:lock:activate | تفعيل قفل |
| inventory:lock:deactivate | إلغاء قفل |
| inventory:audit:read | عرض سجل التدقيق |
| inventory:stock:issue | صرف مخزون (صيانة) |
| inventory:stock:return | إرجاع مخزون (صيانة) |

## توزيع الصلاحيات (مقترح)
| الدور | الصلاحيات الرئيسية |
|-------|-------------------|
| أمين المستودع | إنشاء/عرض/تحديث/تقديم للأرصدة الافتتاحية والتسويات والتحويلات والاستلام والجرد |
| مستخدم الصيانة | إنشاء صرف مخزون الصيانة |
| مشرف الصيانة | صلاحيات الصيانة + الموافقة |
| مشرف المخزون | الموافقة/الترحيل لجميع مستندات المخزون، إدارة الأقفال |
| المسؤول | جميع الصلاحيات |
| المدقق/المشاهد | عرض التقارير ودفتر الأستاذ والتسوية والأقفال والتدقيق |
