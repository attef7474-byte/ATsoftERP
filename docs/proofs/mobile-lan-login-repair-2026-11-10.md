# MOBILE LAN LOGIN REPAIR REPORT

Date: **2026-11-10 — Asia/Aden**. Status: **COMPLETE**. Final decision: **MOBILE_LAN_LOGIN_FIXED**.

**MOBILE_LAN_LOGIN = PASS.** After the Web-only deployment, the owner confirmed: **«نجح الجوال والتحديث، والحاسوب يعمل»** — mobile login succeeded, the session survived refresh, and desktop access remained working.

## Actual Login URL Before Fix

The unchanged application `auth.login → api.post` modules were executed with the LAN page origin `http://192.168.8.156:3000`, using a controlled nonexistent account and real HTTP. The captured request was:

| Property | Observed value |
| --- | --- |
| URL | `http://192.168.8.156:4000/api/v1/auth/login` |
| Method | POST |
| Origin | `http://192.168.8.156:3000` |
| Host | `192.168.8.156:4000` |
| Payload | `{ email, password }`; password redacted in evidence |
| Headers | `Content-Type: application/json`, `x-locale: ar` |
| Credentials mode | Fetch default `same-origin`; no explicit cross-origin cookie credentials |
| Direct HTTP response | 401 `auth.invalidCredentials`, readable by the diagnostic HTTP client |
| OPTIONS preflight | **404**, no `Access-Control-Allow-Origin`, methods or allowed-headers response |

The phone's existing reachability to ports 3000 and 4000 was accepted and independently confirmed. API `GET /` returning 404 is expected, not a connectivity failure.

Observation boundary: the browser access host was unavailable, so no Android DevTools/console trace is claimed. This is an executed application-client/real-HTTP LAN-equivalent capture, supported by source/runtime configuration and actual preflight responses. The final real-phone result was separately confirmed by the owner.

## Root Cause

HTTP pages derived an API origin using the current hostname **and port 4000**. The running API service uses `NODE_ENV=production` with no configured CORS origins, intentionally disabling cross-origin CORS. The JSON login request therefore required a cross-origin preflight, which failed. The browser could not read an application login response and surfaced the existing localized network error.

HTTPS pages already used `/api/v1` on their own origin through Caddy, so desktop `https://dell` avoided this cross-port failure. The LAN request did not point to client `localhost`, `127.0.0.1`, or `https://dell`; hostname resolution/TLS for `dell` was not the cause of this HTTP LAN path.

## Frontend API Base URL

Default browser requests now use **`/api/v1` for both HTTP and HTTPS**. The deployed LAN login URL is:

`http://192.168.8.156:3000/api/v1/auth/login`

Next.js routes `/api/v1/:path*` internally to `http://127.0.0.1:4000/api/v1/:path*`, preserving the method, body, API prefix, and authorization headers. This extends the existing same-origin architecture to direct access on port 3000. It introduces no LAN-IP literal into production routing code. The server-side `localhost:4000` fallback remains internal; browser execution never takes that fallback.

An intentional `NEXT_PUBLIC_API_URL` override remains supported. The example environment file now explains the same-origin default and leaves that optional override commented out. No real environment file was edited.

The external-URL proxy pattern follows the installed Next.js 15 configuration contract and its [official rewrites documentation](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/rewrites). No replacement API or new authentication system was introduced.

## CORS Result

- The repaired browser login is **same-origin**, so it does not require CORS permission or an OPTIONS preflight, even with JSON/custom headers.
- Direct arbitrary-origin API access remains denied to browsers. A real preflight using `https://untrusted.example` still returned no allow-origin or allow-credentials header.
- The repaired port-3000 proxy was also tested with that arbitrary-origin preflight and did not allow it.
- No `*` origin, broader allowlist, forced credentials, or API CORS configuration change was introduced.
- Existing desktop HTTPS and localhost/LAN development access use the same relative browser path. Explicit cross-origin deployments retain responsibility for their intentional override/CORS configuration.

The pre-repair OPTIONS failure is not being concealed by a new permissive policy: the normal request no longer crosses browser origins. API authentication, permissions and tenant/context guards remain in force.

## Authentication Transport

The canonical endpoint is **`POST /api/v1/auth/login`**, derived from the existing controller/global API/version prefix. Authentication returns a JWT `accessToken` and user metadata. The existing client stores the token under `accessToken` in origin-scoped localStorage and sends `Authorization: Bearer …` on protected requests.

No authentication controller/service, password policy, credential, JWT validation, permission or schema change was needed. The real runtime test verified 201 login, 200 profile/permissions/context reads, successful context validation and navigation to `/admin/dashboard` through the new proxy path.

## Cookie / Token Findings

Authentication does **not** depend on an HttpOnly/session/refresh cookie. No auth `Set-Cookie` was returned in the exercised login flow, and no cross-origin `credentials: include` was added. The existing locale cookie is a separate UI preference (`atsoft_locale`, `SameSite=Lax`, path `/`); it is not a session credential.

The real token survived AuthProvider remount/bootstrap in the isolated real-HTTP test. The owner independently confirmed session persistence after refreshing on Android. HTTP-IP and HTTPS-hostname storage remain separate origins; no attempt was made to share tokens across them.

Production password hashes, auth versions and two-factor credential state were fingerprinted before/after and remained unchanged, including after the owner's successful mobile login. Normal login may update `lastLoginAt` and a LOGIN audit record, as the existing authentication contract requires; this is not a password change or ERP business posting.

## HTTPS / LAN HTTP Findings

| Scenario | Browser-facing path | Upstream routing / result |
| --- | --- | --- |
| Desktop `https://dell` | HTTPS `/api/v1/...` | Existing Caddy API route; trusted Windows TLS health and Web checks **200**; owner reports desktop still works |
| Mobile `http://192.168.8.156:3000` | HTTP `/api/v1/...` on port 3000 | Next reverse proxy to internal API; owner confirms login and refresh persistence |
| Isolated LAN-equivalent test | HTTP same-origin on port 3001 | Real Next production engine/compiled app, generated-artifact copy targeting clone API 4013; full login/profile/session/navigation PASS |

No browser HTTPS-to-HTTP downgrade occurs. The desktop browser keeps HTTPS; its existing loopback upstream arrangement is preserved. The explicitly requested HTTP LAN path remains HTTP. No Secure-cookie removal, TLS bypass, certificate trust change, DNS workaround, firewall change, Caddy restart or API restart was used.

## Source Changes

| File | Change |
| --- | --- |
| `apps/web/src/lib/api.ts` | Default browser API base is same-origin for HTTP as well as HTTPS |
| `apps/web/next.config.mjs` | Canonical `/api/v1` external rewrite to internal loopback API |
| `apps/web/.env.example` | Safe same-origin default guidance; no client-localhost example |
| `apps/web/tests/mobile-lan-login.test.ts` | 16 executable regression cases covering base URLs, routing, transport, response classification, token persistence, AuthProvider restore and navigation |
| This report | Scope, proof, security and observation limits |

Existing login failure classification was already correct when a response was readable: 400/401/403/422/500 retain their application status/localized messages, while failed fetches are classified as server-access/network failures. Tests and the deployed LAN probe confirm that invalid credentials now arrive as a readable **401 «بيانات الدخول غير صحيحة»**, rather than being masked by CORS.

The earlier employee-save repair's 18 validated source/test/config/dependency files were checked by SHA256 and preserved unchanged. No backend model/migration, endpoint or permission key was added. No authentication credential or Production business-data mutation was performed by the repair.

## Desktop Regression

The deployment restarted **ATsoftERP_Web only**. The Production API listener PID remained unchanged. Trusted certificate validation succeeded for `https://dell/login` and `https://dell/api/v1/health`, both 200. The Caddy file and real `.env` hashes remained unchanged.

HTTPS API-base/token tests passed, and the owner confirmed that the desktop still works after mobile login. No forced desktop logout, credential reset or copied real password was used to obtain evidence.

## Mobile LAN Proof

1. Before source changes: actual client-module execution selected port 4000; real OPTIONS returned 404 without CORS headers, while direct POST returned 401.
2. After source changes: the compiled Next application was tested through a real isolated Next production server on LAN address/port 3001, proxying exclusively to a disposable SQL Server clone API on 4013. Guarded health comparisons verified that fixture logins could not target Production.
3. A random, controlled account was created only through the canonical registration API in the clone. Login returned 201, protected profile requests returned 200 with bearer authorization, the token persisted, AuthProvider bootstrap restored the session, and the page navigated to the dashboard. A wrong password returned localized 401. Credential state remained unchanged by login.
4. After Web-only deployment: the current client modules called `http://192.168.8.156:3000/api/v1/auth/login`; a controlled nonexistent-account diagnostic returned readable 401, same-origin API health returned 200, and arbitrary-origin preflight remained denied. No real credentials were used in that diagnostic.
5. The owner then confirmed actual Android login, persistence after refresh and continuing desktop access: **«نجح الجوال والتحديث، والحاسوب يعمل»**.

The browser console trace was unavailable; no native automated Android observation is claimed. The real LAN-equivalent network proof and the owner's actual-device confirmation are separate evidence populations.

The disposable clone and both test servers were cleaned up after exporting credential-free evidence. Four controlled accounts from isolated harness iterations were all confined to that clone and removed with it. Initial harness startup/configuration and asynchronous-bootstrap wait issues were corrected; final runtime and regression tests passed without weakening assertions. The source backup and proof artifacts are retained locally.

## Tests

| Gate | Result |
| --- | --- |
| Focused Web authentication suites | **3 suites / 28 tests PASS** |
| Full API regression | **216 suites / 4705 tests PASS** |
| Full Web regression | **87 suites / 1970 tests PASS** |
| Real isolated Next/API/SQL login runtime | PASS: login, protected request, restore, token persistence, navigation, 401 and arbitrary-origin denial |
| API build / Web typecheck | PASS |
| Web production build | PASS, **194 generated pages** |
| i18n | PASS, **6934 EN / 6934 AR** synchronized |
| API route contract | PASS, **1137 matches**, zero mismatches |
| UI baseline / raw keys / permission UI / credentials checks | PASS |
| Source preservation / diff check / artifact checks | PASS |

Existing build warnings concerning missing ESLint configuration and standalone/Next-start use were not hidden; the existing Windows runtime was preserved and verified. No tests were skipped or removed. No new dependency was needed for this repair.

## Git State

Base branch `main`, HEAD `54e3706f98c8ff7aa7f48febe12611015c3e29fe`. The network fix is a **validated, locally deployed working-tree patch**. Existing employee-fix changes and earlier proof files were preserved. No commit, push, branch switch or tag was requested or executed for this task. Ignored build/test/backup evidence remains under `.tmp/mobile-lan-login-repair/`.

Evidence: [before request](../../.tmp/mobile-lan-login-repair/before-request-capture.json), [real LAN-equivalent runtime](../../.tmp/mobile-lan-login-repair/lan-equivalent-runtime-proof.json), [deployed LAN request](../../.tmp/mobile-lan-login-repair/deployed-lan-request-proof.json), [deployment](../../.tmp/mobile-lan-login-repair/deployment-proof.json), [owner mobile/desktop confirmation](../../.tmp/mobile-lan-login-repair/owner-mobile-confirmation.json), [data/credential protection](../../.tmp/mobile-lan-login-repair/production-protection-after.json), [clone cleanup](../../.tmp/mobile-lan-login-repair/clone-cleanup.json).

Final decision: **MOBILE_LAN_LOGIN_FIXED**.
