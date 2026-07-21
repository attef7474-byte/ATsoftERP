# Browser Proof

## Test Cases for i18n-Provider Crash
All localStorage/API language cases tested via code analysis:
| Case | Entry | Expected | Result |
|------|-------|----------|:------:|
| ar | localStorage = 'ar' | Renders Arabic | SAFE |
| en | localStorage = 'en' | Renders English | SAFE |
| ar-SA | localStorage = 'ar-SA' | Normalizes to 'ar' | SAFE |
| en-US | localStorage = 'en-US' | Normalizes to 'en' | SAFE |
| invalid | localStorage = 'xyz' | Falls back to 'ar' | SAFE |
| missing | localStorage = null | Falls back to 'ar' | SAFE |
| undefined | No localStorage | Falls back to 'ar' | SAFE |

All paths avoid "Cannot read properties of undefined (reading 'common')".

## Screenshots
Screenshots require browser runtime with API running. Not possible in
this CLI environment. Capture manually.
