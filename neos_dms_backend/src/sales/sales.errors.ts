import { HttpException, HttpStatus } from '@nestjs/common';

export class SalesOrderNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SALES_ORDER_NOT_FOUND',
        message: `Sales order '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SalesOrderCustomerNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SALES_ORDER_CUSTOMER_NOT_FOUND',
        message: `Party '${id}' is not an active customer`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesOrderSalespersonNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SALES_ORDER_SALESPERSON_NOT_FOUND',
        message: `Salesperson '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesOrderItemNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SALES_ORDER_ITEM_NOT_FOUND',
        message: `Item '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesOrderUomNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SALES_ORDER_UOM_NOT_FOUND',
        message: `UOM '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesOrderUomConversionNotFoundException extends HttpException {
  constructor(fromUomId: string, toUomId: string, itemId: string) {
    super(
      {
        code: 'SALES_ORDER_UOM_CONVERSION_NOT_FOUND',
        message: `No UOM conversion from '${fromUomId}' to '${toUomId}' for item '${itemId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesOrderAccessDeniedException extends HttpException {
  constructor() {
    super(
      {
        code: 'SALES_ORDER_ACCESS_DENIED',
        message: 'You can only manage your own sales orders (or your team’s)',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SalesOrderInvalidTransitionException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: 'SALES_ORDER_INVALID_TRANSITION',
        message: `Cannot transition a ${from} sales order to ${to}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SalesOrderZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'SALES_ORDER_ZERO_QUANTITY',
        message:
          'A line must have a quantity or a free quantity greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

// ── Sales invoices ─────────────────────────────────────────────────────────

export class SalesInvoiceNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'SALES_INVOICE_NOT_FOUND',
        message: `Sales invoice '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SalesInvoiceNotDraftException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'SALES_INVOICE_NOT_DRAFT',
        message: `Cannot ${action} a ${status} sales invoice`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SalesInvoiceOrderNotConfirmableException extends HttpException {
  constructor(orderId: string, status: string) {
    super(
      {
        code: 'SALES_INVOICE_ORDER_NOT_CONFIRMABLE',
        message: `Sales order '${orderId}' is ${status}; only CONFIRMED/COMPLETED orders can be invoiced`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceLineOrderMismatchException extends HttpException {
  constructor(lineId: string, orderId: string) {
    super(
      {
        code: 'SALES_INVOICE_LINE_ORDER_MISMATCH',
        message: `Sales order line '${lineId}' does not belong to order '${orderId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceDuplicateOrderLineException extends HttpException {
  constructor(lineId: string) {
    super(
      {
        code: 'SALES_INVOICE_DUPLICATE_ORDER_LINE',
        message: `Sales order line '${lineId}' appears more than once in the invoice`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceQuantityExceededException extends HttpException {
  constructor(lineId: string, requested: number, remaining: number) {
    super(
      {
        code: 'SALES_INVOICE_QUANTITY_EXCEEDED',
        message: `Cannot invoice ${requested} of sales order line '${lineId}' — only ${remaining} remain`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'SALES_INVOICE_ZERO_QUANTITY',
        message: 'Each invoiced line needs a quantity greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceAccessDeniedException extends HttpException {
  constructor() {
    super(
      {
        code: 'SALES_INVOICE_ACCESS_DENIED',
        message:
          'You can only manage invoices of your own orders (or your team’s)',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SalesInvoiceLocationRequiredException extends HttpException {
  constructor() {
    super(
      {
        code: 'SALES_INVOICE_LOCATION_REQUIRED',
        message:
          'Posting an invoice requires an inventory location to ship from',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceAccountMissingException extends HttpException {
  constructor(purpose: string) {
    super(
      {
        code: 'SALES_INVOICE_ACCOUNT_MISSING',
        message: `Organization has no active '${purpose}' account — run accounting provisioning first`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SalesInvoiceFiscalYearMissingException extends HttpException {
  constructor() {
    super(
      {
        code: 'SALES_INVOICE_FISCAL_YEAR_MISSING',
        message: 'No active, open fiscal year covers the invoice date',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SalesInvoiceUomConversionNotFoundException extends HttpException {
  constructor(uomId: string, baseUomId: string, itemId: string) {
    super(
      {
        code: 'SALES_INVOICE_UOM_CONVERSION_NOT_FOUND',
        message: `No UOM conversion from '${uomId}' to '${baseUomId}' for item '${itemId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class SalesInvoiceTdsWithholdingException extends HttpException {
  constructor(codeName: string) {
    super(
      {
        code: 'SALES_INVOICE_TDS_WITHHOLDING',
        message: `Tax code '${codeName}' is a TDS withholding code — TDS applies to purchases, not sales invoices`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
