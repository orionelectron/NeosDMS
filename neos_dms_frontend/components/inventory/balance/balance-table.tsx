"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { useAuth } from "@/components/providers/auth-provider";
import { MovementFormSheet } from "@/components/inventory/movement/movement-form";
import {
  balanceApi,
  locationApi,
  type InventoryBalance,
} from "@/lib/api/inventory";
import { itemApi } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatMoney, formatNumber } from "@/lib/format";

const PAGE_SIZE = 20;

export function BalanceTable() {
  const { can } = useAuth();
  const canRead = can("inventory.balance.read");
  const canAdjust = can("inventory.transaction.adjust");

  const [locationId, setLocationId] = React.useState("all");
  const [itemId, setItemId] = React.useState("all");
  const [includeZero, setIncludeZero] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [adjustTarget, setAdjustTarget] = React.useState<InventoryBalance | null>(
    null
  );

  const adjustInitial = React.useMemo(
    () =>
      adjustTarget
        ? {
            locationId: adjustTarget.locationId,
            lines: [{ itemId: adjustTarget.itemId, uomId: adjustTarget.item?.baseUomId ?? "" }],
          }
        : undefined,
    [adjustTarget]
  );

  const { data: locationData } = useQuery({
    queryKey: queryKeys.inventory.locationList({ limit: 100 }),
    queryFn: () => locationApi.list({ limit: 100 }),
  });
  const { data: itemData } = useQuery({
    queryKey: queryKeys.trading.itemList({ limit: 100 }),
    queryFn: () => itemApi.list({ limit: 100 }),
  });

  const locationQuery = locationId === "all" ? undefined : locationId;
  const itemQuery = itemId === "all" ? undefined : itemId;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.inventory.balanceList({
      page,
      limit: PAGE_SIZE,
      locationId: locationQuery,
      itemId: itemQuery,
      includeZero: includeZero ? true : undefined,
    }),
    queryFn: () =>
      balanceApi.list({
        page,
        limit: PAGE_SIZE,
        locationId: locationQuery,
        itemId: itemQuery,
        includeZero: includeZero ? true : undefined,
      }),
  });

  const total = data?.meta.total ?? 0;
  const rows = data?.data ?? [];

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock balances" description="On-hand stock at each location." />
        <Card>
          <CardContent className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              You don’t have permission to view stock balances.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Stock balances"
        description="On-hand quantity and moving-average cost per item at each location."
      />

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>On-hand stock</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} balance${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={locationId}
                onValueChange={(value) => {
                  setLocationId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {(locationData?.data ?? []).map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={itemId}
                onValueChange={(value) => {
                  setItemId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {(itemData?.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  id="include-zero"
                  checked={includeZero}
                  onCheckedChange={(checked) => {
                    setIncludeZero(checked);
                    setPage(1);
                  }}
                />
                <Label htmlFor="include-zero" className="text-sm">
                  Show zero
                </Label>
              </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Retail list price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                {canAdjust && <TableHead className="text-right"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    {canAdjust && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-16" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canAdjust ? 7 : 6}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <Boxes
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {locationId !== "all" || itemId !== "all" ? (
                        <p className="text-sm font-medium">
                          No stock matches the current filters
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No stock recorded</p>
                          <p className="text-xs text-muted-foreground">
                            Post opening stock to see balances here.
                          </p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((balance) => {
                  const quantity = Number(balance.quantity);
                  const value = quantity * Number(balance.avgCost || 0);
                  return (
                    <TableRow key={balance.id}>
                      <TableCell className="font-medium">
                        {balance.location?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          {balance.item?.name ?? "—"}
                          <span className="text-xs text-muted-foreground/70">
                            {balance.item?.code ?? ""}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(balance.quantity)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {balance.item?.baseUom?.shortName ?? ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(balance.avgCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(balance.item?.mrp ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(balance.item?.rlp ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(value)}
                      </TableCell>
                      {canAdjust && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjustTarget(balance)}
                          >
                            <SlidersHorizontal aria-hidden />
                            Adjust
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        {!isPending && (
          <CardFooter className="shrink-0 border-t px-5 py-3">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>

      <MovementFormSheet
        open={adjustTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
        mode="adjustment"
        initial={adjustInitial}
      />
    </div>
  );
}
