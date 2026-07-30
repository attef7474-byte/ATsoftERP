# Design System Tokens — Sidebar

## CSS Custom Properties (`globals.css`)

### Layout
```
--sidebar-width: 272px (default), 72px (collapsed)
--sidebar-logo-height: 56px
```

### Colors (default navy theme)
```
--sidebar-bg:           #071A2F
--sidebar-text:         #EAF4FF
--sidebar-text-secondary: #A7B7C9
--sidebar-active-bg:    rgba(20, 184, 166, 0.12)
--sidebar-active-text:  #14B8A6
--sidebar-hover-bg:     rgba(255, 255, 255, 0.04)
--sidebar-hover-text:   #F0F7FF
--sidebar-border:       rgba(255, 255, 255, 0.06)
--sidebar-icon:         #A7B7C9
--sidebar-icon-active:  #14B8A6
```

### Theme Variants (via data attributes)

**Background modes** (`data-sidebar-bg`):
| Value | bg | text | hover |
|-------|----|------|-------|
| navy (default) | `#071A2F` | `#EAF4FF` | `rgba(255,255,255,0.04)` |
| slate | `#1E293B` | `#F1F5F9` | `rgba(255,255,255,0.04)` |
| teal | `#0F766E` | `#ECFDF5` | `rgba(255,255,255,0.06)` |
| custom | `var(--sidebar-custom-bg, #071A2F)` | inherit | inherit |

**Accent modes** (`data-sidebar-accent`):
| Value | accent | active-bg | active-text |
|-------|--------|-----------|-------------|
| teal (default) | `#14B8A6` | `rgba(20,184,166,0.12)` | `#14B8A6` |
| blue | `#3B82F6` | `rgba(59,130,246,0.12)` | `#60A5FA` |
| emerald | `#10B981` | `rgba(16,185,129,0.12)` | `#34D399` |
| violet | `#8B5CF6` | `rgba(139,92,246,0.12)` | `#A78BFA` |

### Density Variants (`data-sidebar-density`)
| Value | item-py | item-px | section-py | group-gap |
|-------|---------|---------|------------|-----------|
| default | `6px` | `12px` | `4px` | `2px` |
| compact | `3px` | `8px` | `2px` | `1px` |
| comfortable | `10px` | `16px` | `6px` | `4px` |

### Font Size Variants (`data-sidebar-font`)
| Value | group-label | section-label | item |
|-------|-------------|---------------|------|
| normal (default) | `13px` | `10px` | `12.5px` |
| large | `14.5px` | `11.5px` | `14px` |

## CSS Classes

| Class | Purpose |
|-------|---------|
| `.admin-sidebar` | Root sidebar container (272px default) |
| `.admin-sidebar-collapsed` | 72px icon-only mode |
| `.admin-sidebar-icons` | Icon column in collapsed mode |
| `.sidebar-icon-btn` | Collapsed icon button |
| `.sidebar-logo` | Logo area at sidebar top |
| `.sidebar-group` | Group wrapper (accordion) |
| `.sidebar-group-btn` | Group toggle button |
| `.sidebar-group-icon` | SVG icon per group |
| `.sidebar-group-label` | Group label text |
| `.sidebar-chevron` | Expand/collapse chevron icon |
| `.sidebar-chevron.open` | Rotated open state |
| `.sidebar-section` | Subgroup section heading |
| `.sidebar-item` | Child navigation link |
| `.sidebar-item.active` | Active route state |
| `.sidebar-direct-link` | Non-expandable group link |
