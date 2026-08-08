"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/app-shell/page-container";
import {
  accountApi,
  journalApi,
  type CoaType,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const CREDIT_NORMAL: CoaType[] = ["LIABILITY", "EQUITY", "INCOME"];

function lineAmount(entry: {
  lines: { accountId: string; debitAmount: string; creditAmount: string }[];
}, accountId: string): { debit: number; credit: number } {
  const line = entry.lines.find((l) => l.accountId === accountId);
  if (!line) return { debit: 0, credit: 0 };
  return {
    debit: Number(line.debitAmount),
    credit: Number(line.creditAmount),
  };
}

interface LedgerTableProps {
  accountId: string;
}

export function LedgerTable({ accountId }: LedgerTableProps) {
  const { data: account } = useQuery({
    queryKey: ["accounting", "accounts", "detail", accountId] as const,
    queryFn: () => accountApi.get(accountId),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.accounting.journalList({
      accountId,
      limit: 100,
    }),
    queryFn: () =>
      journalApi.list({ accountId, limit: 100 }),
  });

  const creditNormal = account ? CREDIT_NORMAL.includes(account.coaType) : false;

  const rows = React.useMemo(() => {
    const chronological = [...(data?.data ?? [])].sort((a, b) =>
      a.entryDate.localeCompare(b.entryDate),
    );
    return chronological.reduce<
      {
        entry: (typeof chronological)[number];
        debit: number;
        credit: number;
        running: number;
      }[]
    >((acc, entry) => {
      const { debit, credit } = lineAmount(entry, accountId);
      const previous = acc.length > 0 ? acc[acc.length - 1].running : 0;
      const running =
        previous + (creditNormal ? credit - debit : debit - credit);
      return [...acc, { entry, debit, credit, running }];
    }, []);
  }, [data, accountId, creditNormal]);

  const closingBalance = rows.length > 0 ? rows[rows.length - 1].running : 0;

  if (isLoading || !account) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <PageContainer
      title={`${account.code} — ${account.name}`}
      description={`Ledger register · ${creditNormal ? "credit-normal" : "debit-normal"} · balances computed on the loaded entries`}
    >
      <Link
        href="/accounting/trial-balance"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Trial balance
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-end gap-4">
            <div className="text-right">
              <span className="block text-xs text-muted-foreground">
                Closing balance
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  closingBalance < 0 && "text-destructive",
                )}
              >
                {formatMoney(Math.abs(closingBalance))}
              </span>
              <span className="block text-xs text-muted-foreground">
                {closingBalance < 0
                  ? creditNormal
                    ? "overdrawn"
                    : "credit balance"
                  : creditNormal
                    ? "credit balance"
                    : "debit balance"}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No entries posted to this account yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ entry, debit, credit, running }) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.entryDate)}</TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/accounting/journal-entries/${entry.id}`}
                          className="hover:underline"
                        >
                          {entry.referenceNumber ?? "—"}
                        </Link>
                        {entry.status !== "POSTED" && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-muted-foreground"
                          >
                            {entry.status.toLowerCase()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {debit > 0 ? formatMoney(debit) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {credit > 0 ? formatMoney(credit) : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          running < 0 && "text-destructive",
                        )}
                      >
                        {formatMoney(Math.abs(running))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
