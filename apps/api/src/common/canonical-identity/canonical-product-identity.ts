/**
 * R4P TASK 5: existing Product duplicate control.
 *
 * The Product model is the inventory-catalog representation of an item, not its
 * technical identity. Measured from the live schema it carries:
 *
 *   code (unique), name, description, categoryId, unit, barcode, qrCode,
 *   minStock, maxStock, status
 *
 * There is deliberately no manufacturer or manufacturer part number on Product,
 * so the identity ladder for a Product is necessarily shorter than the ladder
 * for a SparePart. The strongest identities a Product actually owns are:
 *
 *   1. CODE      the system-assigned or supplied catalog code
 *   2. BARCODE   a scannable identifier that by construction identifies one item
 *   3. QR_CODE   likewise
 *
 * The item name is NOT usable as identity. Two unrelated products can legitimately
 * share a name across manufacturers, and the stage specification forbids inferring
 * technical equivalence from a name in either language.
 *
 * `minStock` / `maxStock` are stock-policy thresholds, never identity. They are
 * deliberately absent from this file's comparison surface.
 */

export const PRODUCT_IDENTITY_LADDER = ['code', 'barcode', 'qrCode'] as const;

export type ProductIdentityField = (typeof PRODUCT_IDENTITY_LADDER)[number];

export const PRODUCT_VERDICT_UNIQUE = 'PRODUCT_IDENTITY_UNIQUE';
export const PRODUCT_VERDICT_EXACT_DUPLICATE = 'PRODUCT_IDENTITY_EXACT_DUPLICATE';
export const PRODUCT_VERDICT_REVIEW_REQUIRED = 'PRODUCT_IDENTITY_REVIEW_REQUIRED';

export interface ProductIdentityInput {
  code?: string | null;
  barcode?: string | null;
  qrCode?: string | null;
}

export interface ProductIdentityCandidate {
  id: string;
  code?: string | null;
  name?: string | null;
  barcode?: string | null;
  qrCode?: string | null;
}

export interface ProductIdentityDecision {
  verdict: typeof PRODUCT_VERDICT_UNIQUE | typeof PRODUCT_VERDICT_EXACT_DUPLICATE | typeof PRODUCT_VERDICT_REVIEW_REQUIRED;
  basis: ProductIdentityField | null;
  basisLabel: string | null;
  matches: ProductIdentityCandidate[];
  reason: string;
}

function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  return trimmed.toLocaleLowerCase();
}

/**
 * Evaluates an incoming Product identity against the existing catalog.
 *
 * `candidates` must already be restricted by the caller to non-deleted rows.
 * Performs no database access and mutates nothing.
 */
export function evaluateProductCanonicalIdentity(
  input: ProductIdentityInput,
  candidates: readonly ProductIdentityCandidate[],
): ProductIdentityDecision {
  const normalizedInput: Record<ProductIdentityField, string | null> = {
    code: normalize(input.code),
    barcode: normalize(input.barcode),
    qrCode: normalize(input.qrCode),
  };

  for (const field of PRODUCT_IDENTITY_LADDER) {
    const inputValue = normalizedInput[field];
    // An empty code/barcode is not an identity. In particular, an auto-generated
    // code that the caller has not yet resolved must not be compared here.
    if (inputValue === null) continue;

    const comparable = candidates.filter((candidate) => normalize(candidate[field]) !== null);
    if (comparable.length === 0) continue;

    const matches = comparable.filter((candidate) => normalize(candidate[field]) === inputValue);

    if (matches.length === 0) {
      return {
        verdict: PRODUCT_VERDICT_UNIQUE,
        basis: field,
        basisLabel: field.toUpperCase(),
        matches: [],
        reason: `No existing product shares this ${field.toUpperCase()} identity.`,
      };
    }

    if (matches.length === 1) {
      const only = matches[0];
      return {
        verdict: PRODUCT_VERDICT_EXACT_DUPLICATE,
        basis: field,
        basisLabel: field.toUpperCase(),
        matches,
        reason: `An existing product already carries this ${field.toUpperCase()} identity (${only.code ?? only.id}). Reuse it instead of creating a duplicate.`,
      };
    }

    return {
      verdict: PRODUCT_VERDICT_REVIEW_REQUIRED,
      basis: field,
      basisLabel: field.toUpperCase(),
      matches,
      reason: `${matches.length} existing products share this ${field.toUpperCase()} identity (${matches
        .map((m) => m.code ?? m.id)
        .join(', ')}). Review and select the correct existing product; no product was chosen automatically.`,
    };
  }

  return {
    verdict: PRODUCT_VERDICT_UNIQUE,
    basis: null,
    basisLabel: null,
    matches: [],
    reason:
      'No product code, barcode or QR code was supplied, so duplicate detection could not be evaluated. The item name was deliberately not used as identity.',
  };
}