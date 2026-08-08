"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { getErrorMessage } from "@/lib/api/http";
import {
  conversionApi,
  itemApi,
  type UomConversion,
} from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { ConversionFormSheet } from "@/components/trading/conversion/conversion-form";

const PAGE_SIZE = 20;

interface ConversionTableProps {
  /** Fixed scope (item detail page). When omitted, shows all conversions with an item filter. */
  itemId?: string;
  itemName?: string;
}

export function ConversionTable({ itemId, itemName }: ConversionTableProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("trading.uom-conversion.create");
  const canDelete = can("trading.uom-conversion.delete");

  const [filterItem, setFilterItem] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<UomConversion | null>(
    null,
  );

  const effectiveItemId = itemId ?? (filterItem === "all" ? undefined : filterItem);

  const { data: itemData } = useQuery({
    queryKey: queryKeys.trading.itemList({ limit: 100 }),
    queryFn: () => itemApi.list({ limit: 100 }),
  });
  const items = itemData?.data ?? [];

  const { data, isPending } = useQuery({
    queryKey: queryKeys.trading.conversionList({
      page,
      limit: PAGE_SIZE,
      itemId: effectiveItemId,
    }),
    queryFn: () =>
      conversionApi.list({ page, limit: PAGE_SIZE, itemId: effectiveItemId }),
  });

  const total = data?.meta.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (conversion: UomConversion) =>
      conversionApi.remove(conversion.id),
    onSuccess: () => {
      toast.success("Conversion deleted.");
      queryClient.invalidateQueries({ queryKey: ["trading", "conversions"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not delete the conversion."));
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title={itemName ? `Conversions for ${itemName}` : "UOM conversions"}
        description="Convert between units — globally or per item (e.g. case ↔ piece)."
        actions={
          canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New conversion
            </Button>
          ) : undefined
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>
              {itemName ? "Unit conversions" : "All conversions"}
            </CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} conversion${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          {!itemId && (
            <CardAction>
              <Select
                value={filterItem}
                onValueChange={(value) => {
                  setFilterItem(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Factor</TableHead>
                <TableHead>Created</TableHead>
                {canDelete && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    {canDelete && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-16" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canDelete ? 6 : 5}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <SlidersHorizontal
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      <p className="text-sm font-medium">No conversions yet</p>
                      <p className="text-xs text-muted-foreground">
                        {itemName
                          ? `Add a case ↔ piece style conversion for ${itemName}.`
                          : "Convert between units globally or for a specific item."}
                      </p>
                      {canCreate && (
                        <Button size="sm" onClick={() => setFormOpen(true)}>
                          <Plus className="size-4" aria-hidden />
                          Create conversion
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((conversion) => (
                  <TableRow key={conversion.id}>
                    <TableCell>
                      {conversion.itemId && conversion.item ? (
                        <span className="flex items-center gap-2">
                          {conversion.item.name}
                          <Badge
                            variant="secondary"
                            className="text-muted-foreground"
                          >
                            item
                          </Badge>
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Global
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {conversion.fromUom.name}{" "}
                      <span className="text-muted-foreground">
                        ({conversion.fromUom.shortName})
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {conversion.toUom.name}{" "}
                      <span className="text-muted-foreground">
                        ({conversion.toUom.shortName})
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(conversion.conversionFactor).toString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(conversion.createdAt)}
                    </TableCell>
                    {canDelete && (
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(conversion)}
                            disabled={deleteMutation.isPending}
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
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

      <ConversionFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        lockedItemId={itemId}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this conversion?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `1 ${deleteTarget.fromUom.shortName} = ${Number(deleteTarget.conversionFactor).toString()} ${deleteTarget.toUom.shortName}`
                : ""}{" "}
              will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
