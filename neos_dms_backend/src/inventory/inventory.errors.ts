import { HttpException, HttpStatus } from '@nestjs/common';

export class InventoryLocationNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'INVENTORY_LOCATION_NOT_FOUND',
        message: `Inventory location '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InventoryLocationCodeAlreadyUsedException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'INVENTORY_LOCATION_CODE_ALREADY_USED',
        message: `An inventory location with code '${code}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InventoryItemNotTrackedException extends HttpException {
  constructor(itemId: string, tracking: string) {
    super(
      {
        code: 'INVENTORY_ITEM_NOT_TRACKED',
        message: `Item '${itemId}' is not quantity-tracked (inventory_tracking=${tracking})`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InventoryZeroQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVENTORY_ZERO_QUANTITY',
        message: 'Line quantity must not be zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InventoryNegativeQuantityException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVENTORY_NEGATIVE_QUANTITY',
        message: 'Line quantity must be greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InventoryInsufficientStockException extends HttpException {
  constructor(itemId: string, available: string, requested: string) {
    super(
      {
        code: 'INVENTORY_INSUFFICIENT_STOCK',
        message: `Item '${itemId}' has only ${available} available but ${requested} requested`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InventorySameLocationTransferException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVENTORY_SAME_LOCATION_TRANSFER',
        message: 'Source and destination locations must differ',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InventoryOpeningStockAlreadyDoneException extends HttpException {
  constructor(locationId: string, itemId: string) {
    super(
      {
        code: 'INVENTORY_OPENING_STOCK_ALREADY_DONE',
        message: `Opening stock already recorded for item '${itemId}' at location '${locationId}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InventoryTransactionNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'INVENTORY_TRANSACTION_NOT_FOUND',
        message: `Inventory transaction '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InventoryUomConversionNotFoundException extends HttpException {
  constructor(fromUomId: string, toUomId: string, itemId?: string | null) {
    super(
      {
        code: 'INVENTORY_UOM_CONVERSION_NOT_FOUND',
        message: `No UOM conversion from '${fromUomId}' to '${toUomId}'${itemId ? ` for item '${itemId}'` : ''}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
