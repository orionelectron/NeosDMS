import { Injectable, Logger } from '@nestjs/common';
import type {
  CbmsInvoiceClient,
  CbmsInvoicePayload,
  CbmsPushResult,
} from './cbms-invoice.client';

/**
 * Real IRD CBMS client — NOT yet activated. Wiring it requires:
 *  1. IRD CBMS API approval and a hardware/software token (TAXIMAIDAI),
 *  2. org-level seller_pan + fiscal year + credentials config,
 *  3. `CBMS_ENABLED=true` (or per-org opt-in) to swap the provider.
 *
 * Endpoint: `POST https://cbapi.ird.gov.np/api/bill`
 * Credit notes: `POST https://cbapi.ird.gov.np/api/billreturn`
 * (used by the Phase 6c returns flow, not this phase).
 *
 * Responses are validated against the IRD schema (messageCode, success,
 * response with token). Until this client is wired, the no-op provider is
 * active and invoices are issued with `cbms_status = NOT_REQUIRED`.
 */
@Injectable()
export class IrdCbmsInvoiceClient implements CbmsInvoiceClient {
  private readonly logger = new Logger(IrdCbmsInvoiceClient.name);

  async pushInvoice(payload: CbmsInvoicePayload): Promise<CbmsPushResult> {
    void payload;
    await Promise.resolve();
    this.logger.warn('IRD CBMS client not activated — treating push as no-op');
    return { pushed: false, skipped: true, error: 'IRD CBMS not activated' };
  }
}
