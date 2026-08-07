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
