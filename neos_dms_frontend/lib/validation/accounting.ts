import { z } from "zod";
import { COA_TYPES, PARTY_KINDS } from "@/lib/api/accounting";

// Mirrors backend `CreateAccountDto` / `UpdateAccountDto` (class-validator)
// exactly. The form uses "" (code) and "none" (parentAccountId sentinel) to
// mean "unset"; the form maps those to undefined/null when building the DTO.
export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().min(1, "Code is required"),
  coaType: z.enum(COA_TYPES, { message: "Select a type" }),
  parentAccountId: z.string(),
  isGroup: z.boolean(),
});

export type AccountValues = z.infer<typeof accountSchema>;

// Mirrors backend `CreateFiscalYearDto` (bsYear int, name optional). The form
// keeps `bsYear` as a string and parses it when building the DTO.
export const fiscalYearSchema = z.object({
  bsYear: z
    .string()
    .trim()
    .min(1, "BS year is required")
    .regex(/^\d{4}$/, "Enter a 4-digit BS year"),
  name: z.string().trim(),
});

export type FiscalYearValues = z.infer<typeof fiscalYearSchema>;

const moneyOrEmpty = z
  .string()
  .trim()
  .regex(/^(?:[0-9]{1,12}(?:\.[0-9]{0,2})?)?$/, "Enter a valid amount (2dp)");

export const PARTY_ADDRESS_TYPES = ["Billing", "Shipping", "Office"] as const;

export const partyAddressSchema = z.object({
  addressType: z.string().min(1, "Select an address type"),
  addressLine1: z.string().trim().min(1, "Address line 1 is required"),
  addressLine2: z.string().trim(),
  city: z.string().trim(),
  isDefault: z.boolean(),
});

export type PartyAddressValues = z.infer<typeof partyAddressSchema>;

// Mirrors backend `CreatePartyDto` (class-validator). Empty strings map to
// null (nullable clears) when building the DTO. At least one role is required.
export const partySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    partyKind: z.enum(PARTY_KINDS),
    isCustomer: z.boolean(),
    isSupplier: z.boolean(),
    isLead: z.boolean(),
    panNumber: z.string().trim(),
    vatNumber: z.string().trim(),
    email: z.string().trim().email("Enter a valid email").or(z.literal("")),
    phone: z.string().trim(),
    address: z.string().trim(),
    creditLimit: moneyOrEmpty,
    openingBalance: moneyOrEmpty,
    branchId: z.string(),
    addresses: z.array(partyAddressSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.isCustomer && !data.isSupplier && !data.isLead) {
      ctx.addIssue({
        code: "custom",
        path: ["isCustomer"],
        message: "Mark the party as customer, supplier, or lead",
      });
    }
  });

export type PartyValues = z.infer<typeof partySchema>;

const amount4dp = z
  .string()
  .trim()
  .regex(/^(?:[0-9]{1,12}(?:\.[0-9]{0,4})?)?$/, "Enter a valid amount (4dp)");

// Mirrors backend `CreateJournalEntryDto` / `JournalLineDto`. Each line needs
// exactly one of debit/credit; the entry must balance (total debit === total
// credit). Money is kept as strings in the form (4dp) and converted on submit.
export const journalLineSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  partyId: z.string(),
  description: z.string(),
  debit: amount4dp,
  credit: amount4dp,
});

export type JournalLineValues = z.infer<typeof journalLineSchema>;

export const journalSchema = z
  .object({
    branchId: z.string().min(1, "Branch is required"),
    entryDate: z.string().min(1, "Entry date is required"),
    description: z.string(),
    lines: z.array(journalLineSchema),
  })
  .superRefine((data, ctx) => {
    const lines = data.lines;
    if (lines.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Add at least one debit and one credit line",
      });
      return;
    }
    let lineRuleBroken = false;
    lines.forEach((line, index) => {
      const debitEmpty = line.debit === "";
      const creditEmpty = line.credit === "";
      if (debitEmpty === creditEmpty) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", index],
          message: "Enter a debit or a credit (not both)",
        });
        lineRuleBroken = true;
      }
    });
    if (lineRuleBroken) return;
    const totalDebit = lines.reduce(
      (sum, line) => sum + (line.debit === "" ? 0 : Number(line.debit)),
      0,
    );
    const totalCredit = lines.reduce(
      (sum, line) => sum + (line.credit === "" ? 0 : Number(line.credit)),
      0,
    );
    if (totalDebit === 0 && totalCredit === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Add at least one debit and one credit amount",
      });
      return;
    }
    if (totalDebit !== totalCredit) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: `Not balanced — debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}`,
      });
    }
  });

export type JournalValues = z.infer<typeof journalSchema>;
