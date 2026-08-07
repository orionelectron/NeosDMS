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
