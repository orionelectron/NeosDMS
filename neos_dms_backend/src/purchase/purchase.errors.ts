import { HttpException, HttpStatus } from '@nestjs/common';

// ── Purchase receipts (GRN) ────────────────────────────────────────────────

export class PurchaseReceiptNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_NOT_FOUND',
        message: `Goods receipt note '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PurchaseReceiptNotDraftException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_NOT_DRAFT',
        message: `Cannot ${action} a ${status} goods receipt note`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReceiptSupplierNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_SUPPLIER_NOT_FOUND',
        message: `Party '${id}' is not an active supplier`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptLocationNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_LOCATION_NOT_FOUND',
        message: `Inventory location '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptItemNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_ITEM_NOT_FOUND',
        message: `Item '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptItemNotTrackedException extends HttpException {
  constructor(id: string, tracking: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_ITEM_NOT_TRACKED',
        message: `Item '${id}' has inventory tracking '${tracking}'; only quantity-tracked items can be received`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptUomNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_UOM_NOT_FOUND',
        message: `UOM '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptUomConversionNotFoundException extends HttpException {
  constructor(uomId: string, baseUomId: string, itemId: string) {
    super(
      {
        code: 'PURCHASE_RECEIPT_UOM_CONVERSION_NOT_FOUND',
        message: `No UOM conversion from '${uomId}' to '${baseUomId}' for item '${itemId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'PURCHASE_RECEIPT_ZERO_QUANTITY',
        message: 'Each received line needs a quantity greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReceiptFiscalYearMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'PURCHASE_RECEIPT_FISCAL_YEAR_MISSING',
        message: 'No active, open fiscal year covers the receipt date',
      },
      HttpStatus.CONFLICT,
    );
  }
}

// ── Purchase bills ──────────────────────────────────────────────────────────

export class PurchaseBillNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_NOT_FOUND',
        message: `Purchase bill '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PurchaseBillNotDraftException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'PURCHASE_BILL_NOT_DRAFT',
        message: `Cannot ${action} a ${status} purchase bill`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillAccountMissingException extends HttpException {
  constructor(purpose: string) {
    super(
      {
        code: 'PURCHASE_BILL_ACCOUNT_MISSING',
        message: `No active account resolves purpose '${purpose}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillSupplierNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_SUPPLIER_NOT_FOUND',
        message: `Party '${id}' is not an active supplier`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillLocationNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_LOCATION_NOT_FOUND',
        message: `Inventory location '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillFiscalYearMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'PURCHASE_BILL_FISCAL_YEAR_MISSING',
        message: 'No active, open fiscal year covers the bill date',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillItemNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_ITEM_NOT_FOUND',
        message: `Item '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillItemNotTrackedException extends HttpException {
  constructor(id: string, tracking: string) {
    super(
      {
        code: 'PURCHASE_BILL_ITEM_NOT_TRACKED',
        message: `Item '${id}' has inventory tracking '${tracking}'; only quantity-tracked items can be billed`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillUomNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_UOM_NOT_FOUND',
        message: `UOM '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillUomConversionNotFoundException extends HttpException {
  constructor(uomId: string, baseUomId: string, itemId: string) {
    super(
      {
        code: 'PURCHASE_BILL_UOM_CONVERSION_NOT_FOUND',
        message: `No UOM conversion from '${uomId}' to '${baseUomId}' for item '${itemId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'PURCHASE_BILL_ZERO_QUANTITY',
        message: 'Each billed line needs a quantity greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillDirectLineIncompleteException extends HttpException {
  constructor(index: number) {
    super(
      {
        code: 'PURCHASE_BILL_DIRECT_LINE_INCOMPLETE',
        message: `Direct bill line ${index + 1} needs an itemId, uomId and quantity`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillReceiptLineNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_LINE_NOT_FOUND',
        message: `Goods receipt line '${id}' not found`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillReceiptNotPostedException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_NOT_POSTED',
        message: `Goods receipt '${id}' is not posted; only posted GRNs can be billed`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillReceiptSupplierMismatchException extends HttpException {
  constructor(receiptLineId: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_SUPPLIER_MISMATCH',
        message: `Goods receipt line '${receiptLineId}' belongs to a different supplier than the bill`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillReceiptLocationMismatchException extends HttpException {
  constructor(receiptLineId: string, receiptLocationId: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_LOCATION_MISMATCH',
        message: `Goods receipt line '${receiptLineId}' landed at location '${receiptLocationId}', not the bill's`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillReceiptLineAlreadyBilledException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_LINE_ALREADY_BILLED',
        message: `Goods receipt line '${id}' was already billed; each GRN line bills once`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseBillReceiptLinePartialException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_LINE_PARTIAL',
        message: `Goods receipt line '${id}' must be billed in full; partial billing is not supported`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillTdsWithholdingException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'PURCHASE_BILL_TDS_WITHHOLDING',
        message: `Tax code '${name}' is a TDS withholding code; specify it via tdsTaxCodeId`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseBillTdsCodeInvalidException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_TDS_CODE_INVALID',
        message: `TDS tax code '${id}' not found or not a TDS_WITHHOLDING code`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
