import { HttpException, HttpStatus } from '@nestjs/common';

export class LeaveTypeNotFoundException extends HttpException {
  constructor() {
    super(
      { code: 'LEAVE_TYPE_NOT_FOUND', message: 'Leave type not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class LeaveTypeInactiveException extends HttpException {
  constructor() {
    super(
      { code: 'LEAVE_TYPE_INACTIVE', message: 'This leave type is inactive' },
      HttpStatus.CONFLICT,
    );
  }
}

export class LeaveTypeCodeAlreadyUsedException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'LEAVE_TYPE_CODE_ALREADY_USED',
        message: `A leave type with code '${code}' already exists in this organization`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class LeaveRequestNotFoundException extends HttpException {
  constructor() {
    super(
      { code: 'LEAVE_REQUEST_NOT_FOUND', message: 'Leave request not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class LeaveBalanceNotFoundException extends HttpException {
  constructor() {
    super(
      { code: 'LEAVE_BALANCE_NOT_FOUND', message: 'Leave balance not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InsufficientLeaveBalanceException extends HttpException {
  constructor(available: number, requested: number) {
    super(
      {
        code: 'INSUFFICIENT_LEAVE_BALANCE',
        message: `Insufficient leave balance (${available} available, ${requested} requested)`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class LeaveOverlapException extends HttpException {
  constructor() {
    super(
      {
        code: 'LEAVE_OVERLAP',
        message:
          'This leave range overlaps an existing pending or approved request',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidLeaveRangeException extends HttpException {
  constructor(message: string) {
    super({ code: 'INVALID_LEAVE_RANGE', message }, HttpStatus.BAD_REQUEST);
  }
}

export class NotTheManagerException extends HttpException {
  constructor() {
    super(
      {
        code: 'NOT_THE_MANAGER',
        message: "Only the requesting user's manager can approve or reject",
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class LeaveStatusTransitionException extends HttpException {
  constructor(message: string) {
    super({ code: 'LEAVE_STATUS_TRANSITION', message }, HttpStatus.CONFLICT);
  }
}
