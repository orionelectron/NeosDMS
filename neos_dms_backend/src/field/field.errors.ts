import { HttpException, HttpStatus } from '@nestjs/common';

export class OutletNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'OUTLET_NOT_FOUND',
        message: `Outlet '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class OutletNameAlreadyUsedException extends HttpException {
  constructor(name: string) {
    super(
      {
        code: 'OUTLET_NAME_ALREADY_USED',
        message: `An outlet named '${name}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class RouteNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'ROUTE_NOT_FOUND',
        message: `Route '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class RouteCodeAlreadyUsedException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'ROUTE_CODE_ALREADY_USED',
        message: `A route with code '${code}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class OutletRouteAlreadyLinkedException extends HttpException {
  constructor(outletId: string, routeId: string) {
    super(
      {
        code: 'OUTLET_ROUTE_ALREADY_LINKED',
        message: `Outlet '${outletId}' is already linked to route '${routeId}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class RouteAssignmentNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'ROUTE_ASSIGNMENT_NOT_FOUND',
        message: `Route assignment '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class RouteAlreadyAssignedException extends HttpException {
  constructor(routeId: string, userId: string) {
    super(
      {
        code: 'ROUTE_ALREADY_ASSIGNED',
        message: `Route '${routeId}' is already assigned to user '${userId}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SalesmanNotAssignedToRouteException extends HttpException {
  constructor(userId: string, routeId: string) {
    super(
      {
        code: 'SALESMAN_NOT_ASSIGNED_TO_ROUTE',
        message: `User '${userId}' is not assigned to route '${routeId}'`,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class OutletNotOnRouteException extends HttpException {
  constructor(outletId: string, routeId: string) {
    super(
      {
        code: 'OUTLET_NOT_ON_ROUTE',
        message: `Outlet '${outletId}' is not on route '${routeId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class RouteStatusTransitionException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: 'INVALID_ROUTE_STATUS_TRANSITION',
        message: `Cannot transition route status from '${from}' to '${to}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class OutletVisitNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'OUTLET_VISIT_NOT_FOUND',
        message: `Outlet visit '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidVisitStatusTransitionException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: 'INVALID_VISIT_STATUS_TRANSITION',
        message: `Cannot transition visit from '${from}' to '${to}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}
