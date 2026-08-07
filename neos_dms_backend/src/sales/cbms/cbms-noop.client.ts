import { Injectable } from '@nestjs/common';
import type {
  CbmsInvoiceClient,
  CbmsInvoicePayload,
  CbmsPushResult,
} from './cbms-invoice.client';

/**
 * Development / non-CBMS default. Returns NOT_REQUIRED semantics (the caller
 * leaves cbms_status untouched) so no network call is made until the org is
 * configured for real IRD e-billing.
 */
@Injectable()
export class NoopCbmsInvoiceClient implements CbmsInvoiceClient {
  pushInvoice(payload: CbmsInvoicePayload): Promise<CbmsPushResult> {
    void payload;
    return Promise.resolve({ pushed: false, skipped: true });
  }
}
