# i18n Proof — AH-AI

## API Messages (api-messages.ts)

13 new keys added:

| Key | EN | AR |
|-----|----|----|
| maintenance.bomNotFound | BOM not found | قائمة المكونات غير موجودة |
| maintenance.bomCannotScopeToBothMachineAndComponent | Cannot scope BOM to both machine and component | لا يمكن تحديد ماكينة ومكون معاً لنفس القائمة |
| maintenance.bomVersionNotFound | BOM version not found | إصدار قائمة المكونات غير موجود |
| maintenance.bomItemNotFound | BOM item not found | عنصر قائمة المكونات غير موجود |
| maintenance.planNotFound | Spare part plan not found | خطة قطع الغيار غير موجودة |
| maintenance.planItemNotFound | Plan item not found | عنصر خطة قطع الغيار غير موجود |
| maintenance.cannotUpdateNonDraftPlan | Cannot update plan outside DRAFT status | لا يمكن تعديل الخطة خارج حالة المسودة |
| maintenance.cannotDeleteNonDraftPlan | Cannot delete plan outside DRAFT status | لا يمكن حذف الخطة خارج حالة المسودة |
| maintenance.invalidPlanStatusTransition | Cannot transition plan to the requested status | لا يمكن تغيير حالة الخطة إلى الحالة المطلوبة |
| maintenance.cannotModifyPlanItemsInCurrentStatus | Cannot modify plan items in current status | لا يمكن تعديل عناصر الخطة في الحالة الحالية |
| maintenance.scheduleNotFound | Schedule not found | جدول الصيانة غير موجود |
| maintenance.scheduleMachineMismatch | Machine does not match the schedule | الماكينة لا تطابق جدول الصيانة |
| maintenance.noItemsToCopy | No items to copy | لا توجد عناصر لنسخها |

EN/AR matched: ✅ 13/13

## Frontend UI Keys (maintenance.ts)

~40 new keys added to EN and AR files:

| Domain | Key Count | EN/AR Match |
|--------|-----------|-------------|
| BOM labels (bom, boms, bomCode, etc.) | 18 | ✅ |
| BOM version labels | 6 | ✅ |
| Plan labels | 16 | ✅ |

Status: ✅

## Settings (settings.ts)

2 new entity types added to both EN and AR:

| Entity Type | EN | AR |
|-------------|----|----|
| MAINTENANCE_BOM | Maintenance BOM | قائمة المكونات |
| PREVENTIVE_SPARE_PART_PLAN | Preventive Spare Part Plan | خطة قطع الغيار الوقائية |

Added to both `operationName` and `modelName` maps: ✅

## i18n Coverage: PASS ✅
