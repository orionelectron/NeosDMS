"use client";

import { useParams } from "next/navigation";
import { LedgerTable } from "@/components/accounting/report/ledger-table";

export default function LedgerPage() {
  const params = useParams<{ accountId: string }>();
  return <LedgerTable accountId={params.accountId} />;
}
