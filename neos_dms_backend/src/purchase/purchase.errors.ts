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

export class PurchaseBillReceiptLineNoRemainingException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_BILL_RECEIPT_LINE_NO_REMAINING',
        message: `Goods receipt line '${id}' has no remaining quantity to bill (already billed or returned)`,
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

// ── Purchase returns (debit notes) ──────────────────────────────────────────

export class PurchaseReturnNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_NOT_FOUND',
        message: `Purchase return '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PurchaseReturnNotDraftException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'PURCHASE_RETURN_NOT_DRAFT',
        message: `Cannot ${action} a ${status} purchase return`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnAccountMissingException extends HttpException {
  constructor(purpose: string) {
    super(
      {
        code: 'PURCHASE_RETURN_ACCOUNT_MISSING',
        message: `No active account resolves purpose '${purpose}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnSupplierNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_SUPPLIER_NOT_FOUND',
        message: `Party '${id}' is not an active supplier`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnLocationNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_LOCATION_NOT_FOUND',
        message: `Inventory location '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnFiscalYearMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'PURCHASE_RETURN_FISCAL_YEAR_MISSING',
        message: 'No active, open fiscal year covers the return date',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnLineIncompleteException extends HttpException {
  constructor(index: number) {
    super(
      {
        code: 'PURCHASE_RETURN_LINE_INCOMPLETE',
        message: `Return line ${index + 1} needs exactly one of sourcePurchaseBillLineId or sourcePurchaseReceiptLineId`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'PURCHASE_RETURN_ZERO_QUANTITY',
        message: 'Each returned line needs a quantity greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnSourceBillLineNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_BILL_LINE_NOT_FOUND',
        message: `Purchase bill line '${id}' not found`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnSourceReceiptLineNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_RECEIPT_LINE_NOT_FOUND',
        message: `Goods receipt line '${id}' not found`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnSourceNotPostedException extends HttpException {
  constructor(kind: string, id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_SOURCE_NOT_POSTED',
        message: `The ${kind} '${id}' is not posted; only posted documents can be returned`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnSupplierMismatchException extends HttpException {
  constructor(sourceLineId: string) {
    super(
      {
        code: 'PURCHASE_RETURN_SUPPLIER_MISMATCH',
        message: `Source line '${sourceLineId}' belongs to a different supplier than the return`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnLocationMismatchException extends HttpException {
  constructor(sourceLineId: string, sourceLocationId: string | null) {
    super(
      {
        code: 'PURCHASE_RETURN_LOCATION_MISMATCH',
        message: `Source line '${sourceLineId}' sits at location '${sourceLocationId}', not the return's`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnReceiptLineBilledException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PURCHASE_RETURN_RECEIPT_LINE_BILLED',
        message: `Goods receipt line '${id}' was already billed; return it via the purchase bill line instead`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseReturnQuantityExceededException extends HttpException {
  constructor(sourceLineId: string, remaining: string) {
    super(
      {
        code: 'PURCHASE_RETURN_QUANTITY_EXCEEDED',
        message: `Source line '${sourceLineId}' has only ${remaining} base units left to return`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PurchaseReturnNoRemainingException extends HttpException {
  constructor(sourceLineId: string) {
    super(
      {
        code: 'PURCHASE_RETURN_NO_REMAINING',
        message: `Source line '${sourceLineId}' has no quantity left to return`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SupplierPaymentNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_NOT_FOUND',
        message: `Supplier payment '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SupplierPaymentNotDraftException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_NOT_DRAFT',
        message: `Supplier payment '${id}' is '${status}' and cannot be ${action}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SupplierPaymentSupplierNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_SUPPLIER_NOT_FOUND',
        message: `Party '${id}' is not an active supplier`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentMethodNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_METHOD_NOT_FOUND',
        message: `Payment method '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentAccountNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_ACCOUNT_NOT_FOUND',
        message: `Payment account '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentAccountTypeException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_ACCOUNT_TYPE',
        message: `Payment account '${id}' must be an active asset account`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentNoAllocationsException extends HttpException {
  constructor() {
    super(
      {
        code: 'SUPPLIER_PAYMENT_NO_ALLOCATIONS',
        message: 'A supplier payment needs at least one bill allocation',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentAllocationZeroException extends HttpException {
  constructor(billId: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_ALLOCATION_ZERO',
        message: `Allocation against bill '${billId}' must be greater than zero`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentAllocationUnbalancedException extends HttpException {
  constructor(paidAmount: string, allocated: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_ALLOCATION_UNBALANCED',
        message: `Allocations (${allocated}) must fully consume the paid amount (${paidAmount})`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentBillNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_BILL_NOT_FOUND',
        message: `Purchase bill '${id}' not found`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SupplierPaymentBillNotPostedException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_BILL_NOT_POSTED',
        message: `Purchase bill '${id}' is not posted; only posted bills can be paid`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SupplierPaymentBillSupplierMismatchException extends HttpException {
  constructor(billId: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_BILL_SUPPLIER_MISMATCH',
        message: `Purchase bill '${billId}' belongs to a different supplier than the payment`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SupplierPaymentAllocationExceedsBalanceException extends HttpException {
  constructor(billId: string, balance: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_ALLOCATION_EXCEEDS_BALANCE',
        message: `Purchase bill '${billId}' has only ${balance} outstanding to pay`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SupplierPaymentFiscalYearMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'SUPPLIER_PAYMENT_FISCAL_YEAR_MISSING',
        message: 'No active, open fiscal year covers the payment date',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SupplierPaymentAccountMissingException extends HttpException {
  constructor(purpose: string) {
    super(
      {
        code: 'SUPPLIER_PAYMENT_ACCOUNT_MISSING',
        message: `No active account resolves purpose '${purpose}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

// ── Expenses (vouchers) ─────────────────────────────────────────────────────

export class ExpenseNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_NOT_FOUND',
        message: `Expense voucher '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ExpenseNotDraftException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'EXPENSE_NOT_DRAFT',
        message: `Cannot ${action} a ${status} expense voucher`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class ExpenseAccountMissingException extends HttpException {
  constructor(purpose: string) {
    super(
      {
        code: 'EXPENSE_ACCOUNT_MISSING',
        message: `No active account resolves purpose '${purpose}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class ExpenseFiscalYearMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'EXPENSE_FISCAL_YEAR_MISSING',
        message: 'No active, open fiscal year covers the expense date',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class ExpensePartyNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_PARTY_NOT_FOUND',
        message: `Party '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseModePartyRequiredException extends HttpException {
  constructor() {
    super(
      {
        code: 'EXPENSE_MODE_PARTY_REQUIRED',
        message: 'A partyId is required when the expense is paid on credit',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpensePaymentAccountMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'EXPENSE_PAYMENT_ACCOUNT_MISSING',
        message:
          'A paymentAccountId is required when the expense is paid in cash',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpensePaymentAccountNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_PAYMENT_ACCOUNT_NOT_FOUND',
        message: `Payment account '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpensePaymentMethodNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_PAYMENT_METHOD_NOT_FOUND',
        message: `Payment method '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpensePaymentAccountTypeException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_PAYMENT_ACCOUNT_TYPE',
        message: `Payment account '${id}' must be an active non-group asset account`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseAccountTypeException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_ACCOUNT_TYPE',
        message: `Expense account '${id}' must be an active non-group expense account`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseLineIncompleteException extends HttpException {
  constructor(index: number) {
    super(
      {
        code: 'EXPENSE_LINE_INCOMPLETE',
        message: `Expense line ${index + 1} needs an expenseAccountId and a description`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'EXPENSE_ZERO_QUANTITY',
        message: 'Each expense line needs a quantity greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseZeroAmountException extends HttpException {
  constructor() {
    super(
      {
        code: 'EXPENSE_ZERO_AMOUNT',
        message: 'The expense must have a net amount greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseTdsWithholdingException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'EXPENSE_TDS_WITHHOLDING',
        message: `Tax code '${name}' is a TDS withholding code; specify it via tdsTaxCodeId`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExpenseTdsCodeInvalidException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'EXPENSE_TDS_CODE_INVALID',
        message: `TDS tax code '${id}' not found or not a TDS_WITHHOLDING code`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
