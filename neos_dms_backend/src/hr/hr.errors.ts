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

export class InvalidBsRangeException extends HttpException {
  constructor(message: string) {
    super({ code: 'INVALID_BS_RANGE', message }, HttpStatus.BAD_REQUEST);
  }
}

export class TravelRequestNotFoundException extends HttpException {
  constructor() {
    super(
      { code: 'TRAVEL_REQUEST_NOT_FOUND', message: 'Travel request not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TravelStatusTransitionException extends HttpException {
  constructor(message: string) {
    super({ code: 'TRAVEL_STATUS_TRANSITION', message }, HttpStatus.CONFLICT);
  }
}

export class TravelRequestMismatchException extends HttpException {
  constructor() {
    super(
      {
        code: 'TRAVEL_REQUEST_MISMATCH',
        message:
          'The travel request does not belong to this user or organization',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class ExpenseClaimNotFoundException extends HttpException {
  constructor() {
    super(
      {
        code: 'EXPENSE_CLAIM_NOT_FOUND',
        message: 'Expense claim not found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ExpenseClaimStatusTransitionException extends HttpException {
  constructor(message: string) {
    super(
      { code: 'EXPENSE_CLAIM_STATUS_TRANSITION', message },
      HttpStatus.CONFLICT,
    );
  }
}

export class ExpenseItemNotFoundException extends HttpException {
  constructor() {
    super(
      { code: 'EXPENSE_ITEM_NOT_FOUND', message: 'Expense item not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidExpenseAmountException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVALID_EXPENSE_AMOUNT',
        message: 'Amount must be a positive number',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AttendanceNotFoundException extends HttpException {
  constructor() {
    super(
      { code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance record not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AttendanceOpenRecordConflictException extends HttpException {
  constructor() {
    super(
      {
        code: 'ATTENDANCE_OPEN_RECORD_CONFLICT',
        message: 'You already have an open attendance record — check out first',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AttendanceNoOpenRecordException extends HttpException {
  constructor() {
    super(
      {
        code: 'ATTENDANCE_NO_OPEN_RECORD',
        message: 'No open attendance record found to check out',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AttendanceAlreadyClosedException extends HttpException {
  constructor() {
    super(
      {
        code: 'ATTENDANCE_ALREADY_CLOSED',
        message: 'This attendance record is already checked out',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AttendanceInvalidCheckoutException extends HttpException {
  constructor(message: string) {
    super(
      { code: 'ATTENDANCE_INVALID_CHECKOUT', message },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AttendanceInvalidLocationException extends HttpException {
  constructor(message: string) {
    super(
      { code: 'ATTENDANCE_INVALID_LOCATION', message },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AttendanceNotOwnedException extends HttpException {
  constructor() {
    super(
      {
        code: 'ATTENDANCE_NOT_OWNED',
        message: 'Attendance records can only be checked out by their owner',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class AttendanceNotReporteeException extends HttpException {
  constructor() {
    super(
      {
        code: 'ATTENDANCE_NOT_REPORTEE',
        message: 'Only a manager of the employee can add or adjust this record',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
