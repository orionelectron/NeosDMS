import { HttpException, HttpStatus } from '@nestjs/common';

export class ItemNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'ITEM_NOT_FOUND',
        message: `Item '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ItemCodeAlreadyUsedException extends HttpException {
  constructor(field: string, value: string) {
    super(
      {
        code: 'ITEM_CODE_ALREADY_USED',
        message: `An item with ${field} '${value}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class ItemCategoryNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'ITEM_CATEGORY_NOT_FOUND',
        message: `Item category '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ItemCategoryCodeAlreadyUsedException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ITEM_CATEGORY_CODE_ALREADY_USED',
        message: `An item category with code '${code}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class BrandNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'BRAND_NOT_FOUND',
        message: `Brand '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BrandNameAlreadyUsedException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'BRAND_NAME_ALREADY_USED',
        message: `A brand named '${name}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class UomNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'UOM_NOT_FOUND',
        message: `Unit of measure '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UomShortNameAlreadyUsedException extends HttpException {
  constructor(shortName: string) {
    super(
      {
        code: 'UOM_SHORT_NAME_ALREADY_USED',
        message: `A unit of measure '${shortName}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class UomConversionNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'UOM_CONVERSION_NOT_FOUND',
        message: `UOM conversion '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SameUomConversionException extends HttpException {
  constructor() {
    super(
      {
        code: 'SAME_UOM_CONVERSION',
        message: 'A conversion cannot be defined between the same unit',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidConversionFactorException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVALID_CONVERSION_FACTOR',
        message: 'Conversion factor must be greater than zero',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class TaxCodeNotFoundInOrgException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'TAX_CODE_NOT_FOUND_IN_ORG',
        message: `Tax code '${id}' not found in this organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AccountNotFoundInOrgException extends HttpException {
  constructor(id: string, label: string) {
    super(
      {
        code: 'ACCOUNT_NOT_FOUND_IN_ORG',
        message: `${label} '${id}' not found in this organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
