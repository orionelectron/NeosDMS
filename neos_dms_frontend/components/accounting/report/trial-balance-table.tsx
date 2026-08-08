"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/app-shell/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fiscalYearApi, trialBalanceApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const COA_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;

function Money({ value }: { value: number }) {
  return (
    <span className={cn("tabular-nums", value !== 0 && "font-medium")}>
      {value === 0 ? "—" : formatMoney(value)}
    </span>
  );
}

export function TrialBalanceTable() {
  const { data: fiscalYears } = useQuery({
    queryKey: queryKeys.accounting.fiscalYearList,
    queryFn: () => fiscalYearApi.list(),
  });

  const activeYear = (fiscalYears ?? []).find((fy) => fy.isActive);
  const fallbackYear = activeYear ?? (fiscalYears ?? [])[0];

  const [selectedYearId, setSelectedYearId] = React.useState("");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");

  const fiscalYearId = selectedYearId || fallbackYear?.id || "";
  const selectedYear =
    (fiscalYears ?? []).find((fy) => fy.id === fiscalYearId) ?? fallbackYear;
  const from = customFrom || selectedYear?.startDate || "";
  const to = customTo || selectedYear?.endDate || "";

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.accounting.trialBalance({
      fiscalYearId: fiscalYearId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    queryFn: () =>
      trialBalanceApi.get({
        fiscalYearId: fiscalYearId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: Boolean(fiscalYearId),
  });

  function handleFiscalYearChange(value: string) {
    setSelectedYearId(value);
    const selected = (fiscalYears ?? []).find((fy) => fy.id === value);
    if (selected) {
      setCustomFrom(selected.startDate);
      setCustomTo(selected.endDate);
    } else {
      setCustomFrom("");
      setCustomTo("");
    }
  }

  const grouped = React.useMemo(() => {
    if (!data) return [];
    return COA_ORDER.map((coaType) => ({
      coaType,
      lines: data.lines.filter((line) => line.coaType === coaType),
    })).filter((group) => group.lines.length > 0);
  }, [data]);

  return (
    <PageContainer
      icon={Scale}
      title="Trial balance"
      description="Opening, activity and closing balances per account within a fiscal year."
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Fiscal year
          </span>
          <Select value={fiscalYearId} onValueChange={handleFiscalYearChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select fiscal year" />
            </SelectTrigger>
            <SelectContent>
              {(fiscalYears ?? []).map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>
                  {fy.name}
                  {fy.isActive ? " (active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            From
          </span>
          <Input
            type="date"
            value={from}
            onChange={(event) => setCustomFrom(event.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            To
          </span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setCustomTo(event.target.value)}
            className="h-9 w-40"
          />
        </div>
      </div>

      {isFetching && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : data ? (
        <>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              data.balanced
                ? "border-transparent bg-success/10 text-success"
                : "border-transparent bg-destructive/10 text-destructive",
            )}
          >
            {data.balanced ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <AlertCircle className="size-4" aria-hidden />
            )}
            <span className="font-medium">
              {data.balanced
                ? "Trial balance is balanced."
                : "Trial balance is out of balance."}
            </span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {data.fiscalYearName} · {data.from} → {data.to}
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trial balance</CardTitle>
              <CardDescription>
                Balances from posted journal entries. Click an account to open
                its ledger.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Opening Dr</TableHead>
                      <TableHead className="text-right">Opening Cr</TableHead>
                      <TableHead className="text-right">Activity Dr</TableHead>
                      <TableHead className="text-right">Activity Cr</TableHead>
                      <TableHead className="text-right">Closing Dr</TableHead>
                      <TableHead className="text-right">Closing Cr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map((group) => (
                      <React.Fragment key={group.coaType}>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={7}>
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {group.coaType}
                            </span>
                          </TableCell>
                        </TableRow>
                        {group.lines.map((line) => (
                          <TableRow key={line.accountId}>
                            <TableCell>
                              <Link
                                href={`/accounting/ledger/${line.accountId}`}
                                className="hover:underline"
                              >
                                <span
                                  className="font-medium"
                                  style={{
                                    paddingLeft: `${(line.level ?? 1) * 12}px`,
                                  }}
                                >
                                  {line.code} — {line.name}
                                </span>
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={line.openingDebit} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={line.openingCredit} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={line.debit} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={line.credit} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={line.closingDebit} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={line.closingCredit} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.openingDebit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.openingCredit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.debit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.credit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.closingDebit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.closingCredit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex h-24 items-center justify-center">
            <Badge variant="secondary" className="text-muted-foreground">
              No fiscal year selected.
            </Badge>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
