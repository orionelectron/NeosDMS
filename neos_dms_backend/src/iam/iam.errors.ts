import { HttpException, HttpStatus } from '@nestjs/common';

export class UserNotFoundException extends HttpException {
  constructor() {
    super(
      {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BranchNotFoundException extends HttpException {
  constructor() {
    super(
      {
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found in this organization',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class RoleNotFoundException extends HttpException {
  constructor(code?: string) {
    super(
      {
        code: 'ROLE_NOT_FOUND',
        message: code ? `Role '${code}' not found` : 'Role not found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class RoleCodeAlreadyUsedException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ROLE_CODE_ALREADY_USED',
        message: `A role with code '${code}' already exists in this organization`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PermissionNotFoundException extends HttpException {
  constructor(code?: string) {
    super(
      {
        code: 'PERMISSION_NOT_FOUND',
        message: code
          ? `Permission '${code}' not found`
          : 'One or more permissions not found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SystemRoleProtectedException extends HttpException {
  constructor() {
    super(
      {
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'System roles cannot be deleted or renamed',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class CannotDeleteSelfException extends HttpException {
  constructor() {
    super(
      {
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class ManagerSelfReferenceException extends HttpException {
  constructor() {
    super(
      {
        code: 'MANAGER_SELF_REFERENCE',
        message: 'A user cannot be their own manager',
      },
      HttpStatus.CONFLICT,
    );
  }
}
