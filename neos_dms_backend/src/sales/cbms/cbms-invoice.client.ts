import { InjectionToken } from '@nestjs/common';

/**
 * Payload sent to the IRD Central Billing Monitoring System (CBMS)
 * (`POST https://cbapi.ird.gov.np/api/bill`). Every field maps 1:1 to a
 * stored `sales_invoices` column so the payload is a pure read with no
 * remapping. Values are the org's configured credentials injected by the
 * provider (never stored per-invoice).
 */
export interface CbmsInvoicePayload {
  sellerPan: string;
  buyerPan: string;
  buyerName: string;
  fiscalYear: string;
  refInvoiceNumber: string;
  totalSales: number;
  taxableSalesVat: number;
  vat: number;
  excisableAmount: number;
  excise: number;
  taxableSalesHst: number;
  hst: number;
  amountForEsf: number;
  esf: number;
  exportSales: number;
  taxExemptedSales: number;
  isRealtime: boolean;
  datetimeClient: string;
}

export interface CbmsPushResult {
  /** true = bill accepted by IRD; false = not transmitted. */
  pushed: boolean;
  reference?: string | null;
  /** true = provider not active (no-op), leave cbms_status NOT_REQUIRED. */
  skipped?: boolean;
  /** optional failure detail written to `cbms_error`. */
  error?: string | null;
}

/**
 * Pluggable IRD e-billing client. The no-op provider ships by default
 * (`cbms_status = NOT_REQUIRED`); the real `https://cbapi.ird.gov.np` client
 * is wired behind a config flag once IRD API approval + credentials exist.
 * CBMS never blocks issuance — a failed push marks the invoice FAILED for a
 * later retry instead of rolling back the posting.
 */
export interface CbmsInvoiceClient {
  pushInvoice(payload: CbmsInvoicePayload): Promise<CbmsPushResult>;
}

export const CBMS_INVOICE_CLIENT: InjectionToken = Symbol(
  'CBMS_INVOICE_CLIENT',
);
