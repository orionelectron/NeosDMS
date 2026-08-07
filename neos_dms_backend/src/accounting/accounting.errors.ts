import { HttpException, HttpStatus } from '@nestjs/common';

export class FiscalYearNotFoundException extends HttpException {
  constructor(organizationId: string) {
    super(
      {
        code: 'FISCAL_YEAR_NOT_FOUND',
        message: `No fiscal year found for organization '${organizationId}'`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class NoActiveFiscalYearException extends HttpException {
  constructor() {
    super(
      {
        code: 'NO_ACTIVE_FISCAL_YEAR',
        message:
          'No active fiscal year is set for this organization. Create/open one first.',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class FiscalYearAlreadyExistsException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'FISCAL_YEAR_ALREADY_EXISTS',
        message: `Fiscal year '${name}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class FiscalYearOverlapException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'FISCAL_YEAR_OVERLAP',
        message: `Fiscal year '${name}' overlaps an existing fiscal year`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class FiscalYearClosedException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'FISCAL_YEAR_CLOSED',
        message: `Fiscal year '${name}' is closed`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class FiscalPeriodLockedException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'FISCAL_PERIOD_LOCKED',
        message: `Fiscal period '${name}' is locked`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class FiscalPeriodNotFoundException extends HttpException {
  constructor(date: string) {
    super(
      {
        code: 'FISCAL_PERIOD_NOT_FOUND',
        message: `No open fiscal period covers the date '${date}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AccountNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'ACCOUNT_NOT_FOUND',
        message: `Account '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AccountCodeAlreadyUsedException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ACCOUNT_CODE_ALREADY_USED',
        message: `An account with code '${code}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AccountParentMustBeGroupException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ACCOUNT_PARENT_MUST_BE_GROUP',
        message: `Parent account '${code}' is not a group account`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AccountHasChildrenException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ACCOUNT_HAS_CHILDREN',
        message: `Cannot delete account '${code}' — it has child accounts`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class AccountInUseException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ACCOUNT_IN_USE',
        message: `Cannot delete account '${code}' — it has journal entries`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SystemAccountProtectedException extends HttpException {
  constructor(message = 'System accounts cannot be modified or deleted') {
    super(
      {
        code: 'SYSTEM_ACCOUNT_PROTECTED',
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class GroupAccountPostingException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'GROUP_ACCOUNT_POSTING',
        message: `Cannot post to group account '${code}' — post to a leaf account instead`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PartyNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'PARTY_NOT_FOUND',
        message: `Party '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PartyRoleRequiredException extends HttpException {
  constructor() {
    super(
      {
        code: 'PARTY_ROLE_REQUIRED',
        message: 'A party must be marked as customer, supplier, or lead',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class TaxCodeNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'TAX_CODE_NOT_FOUND',
        message: `Tax code '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TaxTemplateNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'TAX_TEMPLATE_NOT_FOUND',
        message: `Tax template '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class JournalEntryNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'JOURNAL_ENTRY_NOT_FOUND',
        message: `Journal entry '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UnbalancedJournalException extends HttpException {
  constructor(debit: number, credit: number) {
    super(
      {
        code: 'UNBALANCED_JOURNAL',
        message: 'Journal entry is not balanced',
        details: { debit, credit },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidJournalLineException extends HttpException {
  constructor(index: number, message: string) {
    super(
      {
        code: 'INVALID_JOURNAL_LINE',
        message: `Journal line ${index}: ${message}`,
        details: { index },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class JournalAlreadyPostedException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'JOURNAL_ALREADY_POSTED',
        message: `Journal entry '${id}' is already posted`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class JournalNotDraftException extends HttpException {
  constructor(id: string, status: string) {
    super(
      {
        code: 'JOURNAL_NOT_DRAFT',
        message: `Journal entry '${id}' cannot be cancelled in status '${status}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidAccountForPostingException extends HttpException {
  constructor(accountId: string, message: string) {
    super(
      {
        code: 'INVALID_ACCOUNT_FOR_POSTING',
        message: `Account '${accountId}': ${message}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DocumentSequenceNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DOCUMENT_SEQUENCE_NOT_FOUND',
        message: `Document sequence '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidReportRangeException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: 'INVALID_REPORT_RANGE',
        message: `Report range '${from}' to '${to}' is invalid (from must not be after to)`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
