import { PRODUCTION_MATERIAL_DOCUMENT_TYPES } from './production-material-documents.constants';

/**
 * Domain helpers for production material documents (Phase 1.7).
 *
 * Material documents are production source records that post exactly one inventory
 * effect through the existing InventoryMovement ledger. This module maps document
 * types to ledger directions and to the movement type recorded on the movement.
 */

export type ProductionMaterialDocumentType = (typeof PRODUCTION_MATERIAL_DOCUMENT_TYPES)[number];

export function isProductionMaterialDocumentType(value: string): value is ProductionMaterialDocumentType {
  return (PRODUCTION_MATERIAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** OUT consumes stock from the issue warehouse; IN returns stock to it. */
export function materialDocumentDirection(documentType: ProductionMaterialDocumentType): 'IN' | 'OUT' {
  switch (documentType) {
    case 'RETURN':
      return 'IN';
    case 'ISSUE':
    case 'CONSUMPTION':
    case 'SUBSTITUTION':
    default:
      return 'OUT';
  }
}

export function materialMovementType(documentType: ProductionMaterialDocumentType): string {
  switch (documentType) {
    case 'ISSUE':
      return 'PRODUCTION_ISSUE';
    case 'CONSUMPTION':
      return 'PRODUCTION_CONSUMPTION';
    case 'RETURN':
      return 'PRODUCTION_RETURN';
    case 'SUBSTITUTION':
      return 'PRODUCTION_SUBSTITUTION';
  }
}

/**
 * The document type that reverses a posted document's inventory effect.
 * ISSUE and CONSUMPTION are reversed by RETURN; RETURN is reversed by ISSUE;
 * SUBSTITUTION reverses itself with substituted/original products swapped.
 */
export function materialReverseType(documentType: ProductionMaterialDocumentType): ProductionMaterialDocumentType {
  switch (documentType) {
    case 'ISSUE':
    case 'CONSUMPTION':
      return 'RETURN';
    case 'RETURN':
      return 'ISSUE';
    case 'SUBSTITUTION':
      return 'SUBSTITUTION';
  }
}

/**
 * Every material document posts an inventory movement, which always requires a
 * warehouse (including SUBSTITUTION, which moves the substituted product OUT and the
 * substitute IN at the same warehouse).
 */
export function materialDocumentRequiresWarehouse(_documentType: ProductionMaterialDocumentType): boolean {
  return true;
}
