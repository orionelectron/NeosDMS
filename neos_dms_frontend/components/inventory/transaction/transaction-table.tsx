"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowUpDown, PackagePlus } from "lucide-react";
import { PageContainer } from "@/components/app-shell/page-container";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
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
import { TablePagination } from "@/components/ui/table-pagination";
import { useAuth } from "@/components/providers/auth-provider";
import {
  INVENTORY_TXN_TYPES,
  INVENTORY_TXN_TYPE_LABELS,
  locationApi,
  transactionApi,
  type InventoryTxnType,
} from "@/lib/api/inventory";
import { itemApi } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  MovementFormSheet,
  type MovementMode,
} from "@/components/inventory/movement/movement-form";

const PAGE_SIZE = 20;

export function TransactionTable() {
  const { can } = useAuth();
  const canCreate = can("inventory.transaction.create");
  const canAdjust = can("inventory.transaction.adjust");

  const [locationId, setLocationId] = React.useState("all");
  const [itemId, setItemId] = React.useState("all");
  const [type, setType] = React.useState<"all" | InventoryTxnType>("all");
  const [page, setPage] = React.useState(1);
  const [movementMode, setMovementMode] = React.useState<MovementMode | null>(
    null,
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
  const typeQuery = type === "all" ? undefined : type;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.inventory.transactionList({
      page,
      limit: PAGE_SIZE,
      locationId: locationQuery,
      itemId: itemQuery,
      type: typeQuery,
    }),
    queryFn: () =>
      transactionApi.list({
        page,
        limit: PAGE_SIZE,
        locationId: locationQuery,
        itemId: itemQuery,
        type: typeQuery,
      }),
  });

  const total = data?.meta.total ?? 0;
  const rows = data?.data ?? [];

  const canPost = canCreate || canAdjust;

  return (
    <PageContainer
      icon={ArrowUpDown}
      title="Stock movements"
      description="Opening stock, adjustments and transfers posted to stock."
      actions={
        canPost ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <ArrowUpDown className="size-4" aria-hidden />
                Post stock
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canCreate && (
                <>
                  <DropdownMenuItem onSelect={() => setMovementMode("opening")}>
                    <PackagePlus className="size-4" aria-hidden />
                    Opening stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setMovementMode("transfer")}>
                    <ArrowLeftRight className="size-4" aria-hidden />
                    Transfer
                  </DropdownMenuItem>
                </>
              )}
              {canAdjust && (
                <DropdownMenuItem onSelect={() => setMovementMode("adjustment")}>
                  <ArrowUpDown className="size-4" aria-hidden />
                  Adjustment
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All movements</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} transaction${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value as "all" | InventoryTxnType);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {INVENTORY_TXN_TYPES.map((txnType) => (
                    <SelectItem key={txnType} value={txnType}>
                      {INVENTORY_TXN_TYPE_LABELS[txnType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <SelectTrigger className="w-44">
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
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">To</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Occurred</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <ArrowUpDown
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {locationId !== "all" || itemId !== "all" || type !== "all" ? (
                        <p className="text-sm font-medium">
                          No movements match the current filters
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No movements yet</p>
                          <p className="text-xs text-muted-foreground">
                            Post opening stock or an adjustment to see it here.
                          </p>
                          {canPost && (
                            <Button
                              size="sm"
                              onClick={() => setMovementMode("opening")}
                            >
                              Post opening stock
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/inventory/transactions/${transaction.id}`}
                        className="hover:text-accent"
                      >
                        {transaction.transactionNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.transactionType === "stock_adjustment"
                            ? "outline"
                            : "secondary"
                        }
                        className={cn(
                          transaction.transactionType === "stock_adjustment" &&
                            "text-muted-foreground",
                        )}
                      >
                        {INVENTORY_TXN_TYPE_LABELS[transaction.transactionType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.location?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {transaction.toLocation?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.referenceType ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(transaction.occurredAt)}
                    </TableCell>
                  </TableRow>
                ))
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
        open={movementMode !== null}
        onOpenChange={(open) => {
          if (!open) setMovementMode(null);
        }}
        mode={movementMode ?? "opening"}
      />
    </PageContainer>
  );
}
