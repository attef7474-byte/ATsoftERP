# Mobile Testing Notes

> Responsive behavior and known issues

## Tested Devices

| Device | Screen Size | Browser | Status |
|--------|-------------|---------|--------|
| iPad (10.2") | 1080×810 | Safari | Functional with minor layout issues |
| iPad Pro (11") | 1194×834 | Safari | Good |
| Surface Go | 1280×720 | Edge | Good |
| iPhone 12 | 390×844 | Safari | Limited (tables overflow) |
| Android 12 (small) | 360×760 | Chrome | Limited (tree view issues) |

## Known Issues

1. Tables with many columns require horizontal scrolling on screens < 768px
2. Tree view expand/collapse works but nodes may overflow
3. F9 search modal covers most of screen on small devices
4. Sidebar collapses into hamburger menu but some nested items overlap
5. Calendar widget in Preventive/Schedules shows partial content on small screens

## Recommendation

- Tablets are acceptable for basic operations
- Smartphones should be used for read-only reference (KIOSK role)
- All inventory entry operations should be done on desktop
