"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
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
import { locationApi, lowStockApi } from "@/lib/api/inventory";
import { queryKeys } from "@/lib/query/keys";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export function LowStockTable() {
  const { can } = useAuth();
  const canRead = can("inventory.balance.read");

  const [locationId, setLocationId] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const { data: locationData } = useQuery({
    queryKey: queryKeys.inventory.locationList({ limit: 100 }),
    queryFn: () => locationApi.list({ limit: 100 }),
  });

  const locationQuery = locationId === "all" ? undefined : locationId;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.inventory.lowStockList({
      page,
      limit: PAGE_SIZE,
      locationId: locationQuery,
    }),
    queryFn: () =>
      lowStockApi.list({
        page,
        limit: PAGE_SIZE,
        locationId: locationQuery,
      }),
  });

  const total = data?.meta.total ?? 0;
  const rows = data?.data ?? [];

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Low stock"
          description="Items at or below their reorder level."
        />
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
    <div className="space-y-6">
      <PageHeader
        title="Low stock"
        description="Items at or below their reorder level — restock before they run out."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Items to restock</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} item${total === 1 ? "" : "s"} need${total === 1 ? "s" : ""} attention`}
            </CardDescription>
          </div>
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reorder level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
                        <AlertTriangle className="size-5" aria-hidden />
                      </span>
                      <p className="text-sm font-medium">
                        Nothing to restock
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Every item is above its reorder level.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => {
                  const out = row.onHand <= 0;
                  return (
                    <TableRow key={`${row.itemId}-${row.locationId ?? "all"}-${index}`}>
                      <TableCell className="font-medium">
                        <span className="flex flex-col">
                          {row.itemName}
                          <span className="text-xs text-muted-foreground/70">
                            {row.itemCode ?? ""}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.locationName ?? "Not stocked"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.onHand)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(row.reorderLevel)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={out ? "destructive" : "default"}
                          className={cn(
                            !out && "bg-warning/15 text-warning hover:bg-warning/15",
                          )}
                        >
                          {out ? "Out of stock" : "Low"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        {!isPending && (
          <CardFooter className="border-t pt-4">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
