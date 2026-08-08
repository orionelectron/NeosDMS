import { HttpException, HttpStatus } from '@nestjs/common';

// ── Vehicles ────────────────────────────────────────────────────────────────

export class VehicleNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'VEHICLE_NOT_FOUND',
        message: `Vehicle '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class VehicleRegistrationAlreadyUsedException extends HttpException {
  constructor(registrationNumber: string) {
    super(
      {
        code: 'VEHICLE_REGISTRATION_ALREADY_USED',
        message: `A vehicle with registration '${registrationNumber}' already exists`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class VehicleDriverNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'VEHICLE_DRIVER_NOT_FOUND',
        message: `Driver user '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

// ── Dispatches ──────────────────────────────────────────────────────────────

export class DispatchNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_NOT_FOUND',
        message: `Dispatch '${id}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DispatchAccessDeniedException extends HttpException {
  constructor() {
    super(
      {
        code: 'DISPATCH_ACCESS_DENIED',
        message: 'Drivers can only access their own dispatches',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class DispatchInvalidTransitionException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: 'DISPATCH_INVALID_TRANSITION',
        message: `Cannot transition a ${from} dispatch to ${to}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchVehicleNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_VEHICLE_NOT_FOUND',
        message: `Vehicle '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchDriverNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_DRIVER_NOT_FOUND',
        message: `Driver '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchLocationNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_LOCATION_NOT_FOUND',
        message: `Inventory location '${id}' not found or inactive`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchRouteNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_ROUTE_NOT_FOUND',
        message: `Route '${id}' not found`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchOrderNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_ORDER_NOT_FOUND',
        message: `Sales order '${id}' not found in the organization`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchOrderNotAllocatableException extends HttpException {
  constructor(id: string, status: string) {
    super(
      {
        code: 'DISPATCH_ORDER_NOT_ALLOCATABLE',
        message: `Sales order '${id}' is ${status}; only CONFIRMED/COMPLETED orders can be dispatched`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchOrderAlreadyAllocatedException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_ORDER_ALREADY_ALLOCATED',
        message: `Sales order '${id}' is already on an active dispatch`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchOrderNothingToDispatchException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_ORDER_NOTHING_TO_DISPATCH',
        message: `Sales order '${id}' has no quantity left to dispatch`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchNoStopsException extends HttpException {
  constructor() {
    super(
      {
        code: 'DISPATCH_NO_STOPS',
        message: 'A dispatch needs at least one eligible order',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchDepartureNotLoadedException extends HttpException {
  constructor(id: string, status: string) {
    super(
      {
        code: 'DISPATCH_NOT_LOADED',
        message: `Dispatch '${id}' is ${status}; only LOADED dispatches can depart`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchDriverActionNotAllowedException extends HttpException {
  constructor(action: string) {
    super(
      {
        code: 'DISPATCH_DRIVER_ACTION_NOT_ALLOWED',
        message: `Drivers cannot ${action} a dispatch`,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class DispatchVehicleBusyException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_VEHICLE_BUSY',
        message: `Vehicle '${id}' is already on an active dispatch`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchDriverBusyException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_DRIVER_BUSY',
        message: `Driver '${id}' is already on an active dispatch`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchBranchNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_BRANCH_NOT_FOUND',
        message: `Branch '${id}' not found`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchVehicleDriverRequiredException extends HttpException {
  constructor() {
    super(
      {
        code: 'DISPATCH_VEHICLE_DRIVER_REQUIRED',
        message: 'A dispatch needs a vehicle and a driver before loading',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchStockInsufficientException extends HttpException {
  constructor(itemCode: string, onHand: number, required: number) {
    super(
      {
        code: 'DISPATCH_STOCK_INSUFFICIENT',
        message: `Stock short for item '${itemCode}': ${onHand} on hand, ${required} required — the run cannot depart`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchDepartureNoLocationException extends HttpException {
  constructor(id: string) {
    super(
      {
        code: 'DISPATCH_DEPARTURE_NO_LOCATION',
        message: `Dispatch '${id}' has no source inventory location — set one before departing`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchAlreadyResolvedException extends HttpException {
  constructor(id: string, status: string, action: string) {
    super(
      {
        code: 'DISPATCH_ALREADY_RESOLVED',
        message: `Cannot ${action} stop '${id}' — it is already '${status}'`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchDeliveryEventMismatchException extends HttpException {
  constructor(eventId: string) {
    super(
      {
        code: 'DISPATCH_DELIVERY_EVENT_MISMATCH',
        message: `Delivery event '${eventId}' was already applied to this stop with a different payload`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchStopLineNotFoundException extends HttpException {
  constructor(stopId: string, orderLineId: string) {
    super(
      {
        code: 'DISPATCH_STOP_LINE_NOT_FOUND',
        message: `Stop '${stopId}' has no line for order line '${orderLineId}'`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchStopLineMismatchException extends HttpException {
  constructor() {
    super(
      {
        code: 'DISPATCH_STOP_LINE_MISMATCH',
        message: 'Delivery lines must cover exactly the stop’s allocated lines',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchStopQuantitiesExceededException extends HttpException {
  constructor(orderLineId: string, allocated: number) {
    super(
      {
        code: 'DISPATCH_STOP_QUANTITIES_EXCEEDED',
        message: `Order line '${orderLineId}' is allocated ${allocated}; delivered + returned cannot exceed it`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchStopFailureReasonRequiredException extends HttpException {
  constructor() {
    super(
      {
        code: 'DISPATCH_STOP_FAILURE_REASON_REQUIRED',
        message: 'A FAILED delivery requires a failure_reason',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchStopNothingRecordedException extends HttpException {
  constructor() {
    super(
      {
        code: 'DISPATCH_STOP_NOTHING_RECORDED',
        message:
          'A delivery must record at least one delivered or returned quantity',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DispatchCompleteStopsPendingException extends HttpException {
  constructor(pendingCount: number) {
    super(
      {
        code: 'DISPATCH_COMPLETE_STOPS_PENDING',
        message: `Cannot complete — ${pendingCount} stop(s) are still PENDING`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class DispatchShortfallInvoiceMissingException extends HttpException {
  constructor(stopId: string) {
    super(
      {
        code: 'DISPATCH_SHORTFALL_INVOICE_MISSING',
        message: `Cannot draft a credit note for stop '${stopId}' — it has no depart invoice`,
      },
      HttpStatus.CONFLICT,
    );
  }
}
