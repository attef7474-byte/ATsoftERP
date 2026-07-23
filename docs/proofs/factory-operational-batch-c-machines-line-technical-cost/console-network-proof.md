# Console & Network Proof — Batch C Machines

## Verification method

Playwright tests captured browser console logs and network request failures during the 6 browser-proof tests. The debug session used `page.on('requestfailed')` and `page.on('response')` listeners to track HTTP errors.

## Results

### Console errors
| Source | Count | Detail |
|--------|-------|--------|
| React hydration warnings | 0 | — |
| 404 chunk load errors | 0 | All chunk files resolved after rebuild |
| Auth/API errors | 0 | Token-based auth works silently |
| Uncaught exceptions | 0 | — |
| **Total** | **0** | Clean console |

### Network (API) requests
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/auth/login` (Node fetch from test) | POST | 201 | Obtain access token |
| `/auth/me` (from AdminShell) | GET | 200 | Load user profile |
| `/maintenance/machines?limit=...` (from pages) | GET | 200 | Load machine list |

**No failed API requests** were observed during any of the 6 browser tests.

### Failed resource loads
| Resource | Status | Cause | Resolution |
|----------|--------|-------|------------|
| `/_next/static/chunks/main-app.js` | 404 (stale build) | Server referenced non-hashed name; build output had hashed name | Rebuilt with `next build` and restarted server |
| `/_next/static/chunks/app/admin/layout.js` | 404 (stale build) | Same chunk-name mismatch | Same fix |
| `/_next/static/chunks/app-pages-internals.js` | 404 (stale build) | Removed in newer Next.js build | Same fix |

After the web app rebuild (`next build`) and server restart, all chunk URLs resolve correctly (HTTP 200).

## Conclusion

- **Console**: clean, no errors or warnings
- **Network**: all API calls succeed; no failed HTTP requests
- **Chunks**: all JS/CSS bundles load correctly after rebuild
