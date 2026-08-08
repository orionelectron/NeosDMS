"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useAuth } from "@/components/providers/auth-provider";
import {
  INVENTORY_TXN_TYPE_LABELS,
  transactionApi,
} from "@/lib/api/inventory";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const canRead = can("inventory.transaction.read");

  const { data: transaction, isPending, isError } = useQuery({
    queryKey: queryKeys.inventory.transactionDetail(params.id),
    queryFn: () => transactionApi.get(params.id),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/inventory/transactions">
          <ArrowLeft className="size-4" aria-hidden />
          Back to movements
        </Link>
      </Button>

      {!canRead ? (
        <p className="text-sm text-muted-foreground">
          You don’t have permission to view stock movements.
        </p>
      ) : isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError || !transaction ? (
        <p className="text-sm text-muted-foreground">
          This movement could not be loaded.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">
              {transaction.transactionNumber}
            </h1>
            <Badge variant="secondary">
              {INVENTORY_TXN_TYPE_LABELS[transaction.transactionType]}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Status
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    <Badge
                      variant="default"
                      className="bg-success/10 text-success hover:bg-success/10"
                    >
                      {transaction.status}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Location
                  </dt>
                  <dd className="mt-1 text-sm">
                    {transaction.location?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Destination
                  </dt>
                  <dd className="mt-1 text-sm">
                    {transaction.toLocation?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Occurred
                  </dt>
                  <dd className="mt-1 text-sm">
                    {formatDateTime(transaction.occurredAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Reference
                  </dt>
                  <dd className="mt-1 text-sm">
                    {transaction.referenceType ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Notes
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {transaction.notes ?? "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transaction.lines ?? []).map((line) => {
                    const quantity = Number(line.quantity);
                    const unitCost = Number(line.unitCost || 0);
                    return (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">
                          <span className="flex flex-col">
                            {line.item?.name ?? "—"}
                            <span className="text-xs text-muted-foreground/70">
                              {line.item?.code ?? ""}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.uom?.shortName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={line.direction === "IN" ? "default" : "outline"}
                            className={cn(
                              line.direction === "IN"
                                ? "bg-success/10 text-success hover:bg-success/10"
                                : "text-destructive",
                            )}
                          >
                            {line.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(line.quantity)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(line.unitCost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(quantity * unitCost)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
