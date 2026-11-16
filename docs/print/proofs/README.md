# Unified print evidence

These are real PDF/PNG rendering artifacts, not browser screenshots and not synthetic success evidence. Generated 2026-11-10 from the actual `PrintDocument` component and shared CSS, using WeasyPrint 70.0; rasterized with PyMuPDF. See `../ATsoftERP-print-validation.md` for the acceptance decision and limitations.

| Artifact | Dataset / purpose |
| --- | --- |
| maintenance-requests-print.pdf; maintenance-requests-after-ar.png | Canonical authenticated report GET: one existing request, authorized جوبح / المركز الرئيسي context from auth/contexts, actual principal display name and generation timestamp |
| maintenance-requests-en.pdf; maintenance-requests-after-en.png | Identical actual business data/context with English LTR labels |
| maintenance-requests-filtered.pdf / .png | Three in-memory non-production fixture rows, date/status/priority/line filters; no database fixture inserts |
| maintenance-requests-empty.pdf / .png | Actual canonical report returns zero rows for 1900-01-01 through 1900-01-02 |
| maintenance-requests-multipage.pdf / .png / -page-6.png | 85 in-memory TEST-MR fixture rows; six A4 portrait pages; mixed Arabic/English, long text and repeated table headers |
| maintenance-requests-multipage-en.pdf / .png / -page-6.png | Same 85 fixture rows, English LTR, six portrait pages |
| shared-print-landscape.pdf / .png / -page-6.png | Shared engine landscape capability only; reference policy remains portrait |
| maintenance-requests-grayscale.png | Grayscale raster of actual Arabic report; meaning does not depend on color |

The actual report context is an authorized API read context, not a claim about the currently selected context in the owner's browser. The fixture documents reuse the actual company header solely to exercise the same template locally; their TEST-MR business numbers clearly identify the non-production dataset. No fixture was created in Production.

`maintenance-requests-before.png` is deliberately absent: a real original browser print screenshot could not be captured. No replacement image was fabricated. The owner accepted the reference preview and all twelve subsequent P0 native previews in both languages. Native saved PDF files and cancellation screenshots remain uncaptured. Standalone rendering does not prove that a browser implements every CSS or iframe rule identically.

The renderer reported that `unicode-bidi:isolate` is unsupported; actual mixed-direction output was inspected, but this does not certify the native browser. Its Windows GLib application-manifest warning did not prevent PDF generation. Dimensions, row coverage and text bounds are recorded in `.tmp/unified-print/pdf-inspection.json`; source/dataset/generation metadata are recorded in `render-manifest.json`. These temporary evidence files contain no passwords, JWTs or connection strings.

## P0 maintenance artifacts

Generated from actual source components/shared CSS in the prescribed page order. maintenance-overview-* and maintenance-kpis-* contain actual/empty AR/EN cases. The remaining maintenance-{downtime,costs,schedules,assets,machine-log,parts-usage,upcoming-preventive,overdue-preventive,parts,low-stock}-* families contain actual/empty and multi-page or composite AR/EN cases. Empty cases use explicit in-memory fixtures except downtime, which uses a real empty historical date filter. TEST fixtures are labelled, never inserted into the database. Actual parts/low-stock proofs narrow search to an existing code; over-500 unfiltered collection is verified as refused.

Per-page raster images come from these PDFs, not browser screenshots. Dimensions, text bounds and exactly-once fixture-row coverage are checked. See p0-evidence.json for artifact hashes and owner-p0-confirmation.json for the separate native acceptance. Native preview acceptance does not certify Windows standalone packaging or Production deployment.
