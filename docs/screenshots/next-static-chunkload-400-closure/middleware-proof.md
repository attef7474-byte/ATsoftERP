# Middleware Proof

## Check Performed
- Glob search for `**/middleware*` — no results
- Grep for `middleware|matcher|NextResponse|rewrite|redirect|_next|static|pathname` in all `.ts`/`.tsx` files
- Inspection of `next.config.ts`

## Results
- No middleware files exist
- `next.config.ts` contains only `images: { unoptimized: true }`
- No rewrites, redirects, or route matchers that could interfere with `/_next/static/*`

## Conclusion
Middleware is completely absent. The 400 errors were NOT caused by middleware blocking static assets.

## Static Assets Bypass
No bypass needed — there is no middleware to bypass.
