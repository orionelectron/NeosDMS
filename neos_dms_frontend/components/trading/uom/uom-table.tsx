"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Power, PowerOff, Ruler, Search, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { uomApi, type Uom } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UomFormSheet } from "@/components/trading/uom/uom-form";

const PAGE_SIZE = 20;

export function UomTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("trading.uom.create");
  const canUpdate = can("trading.uom.update");
  const canDelete = can("trading.uom.delete");
  const canManageActions = canUpdate || canDelete;

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Uom | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Uom | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.trading.uomList({ search, page, limit: PAGE_SIZE }),
    queryFn: () => uomApi.list({ search, page, limit: PAGE_SIZE }),
  });

  const total = data?.meta.total ?? 0;

  const toggleMutation = useMutation({
    mutationFn: (uom: Uom) =>
      uomApi.update(uom.id, { isActive: !uom.isActive }),
    onSuccess: (_data, uom) => {
      toast.success(uom.isActive ? "Unit deactivated." : "Unit activated.");
      queryClient.invalidateQueries({ queryKey: ["trading", "uoms"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the unit."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (uom: Uom) => uomApi.remove(uom.id),
    onSuccess: (_data, uom) => {
      toast.success(`Unit "${uom.name}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ["trading", "uoms"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not delete the unit."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(uom: Uom) {
    setEditing(uom);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units of measure"
        description="Units like case, box or piece used across the system."
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New unit
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>All units</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} unit${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search units…"
                className="w-56 pl-9"
                aria-label="Search units"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Short name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                {canManageActions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    {canManageActions && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-24" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageActions ? 5 : 4} className="h-40 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <Ruler className="size-5 text-muted-foreground" aria-hidden />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No units match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No units yet</p>
                          <p className="text-xs text-muted-foreground">
                            Create your first unit of measure, e.g. case, box or
                            piece.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create unit
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((uom) => (
                  <TableRow key={uom.id}>
                    <TableCell className="font-medium">{uom.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {uom.shortName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={uom.isActive ? "default" : "outline"}
                        className={cn(
                          uom.isActive &&
                            "bg-success/10 text-success hover:bg-success/10",
                        )}
                      >
                        {uom.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(uom.updatedAt)}
                    </TableCell>
                    {canManageActions && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(uom)}
                            >
                              <Pencil className="size-4" aria-hidden />
                              Edit
                            </Button>
                          )}
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMutation.mutate(uom)}
                              disabled={toggleMutation.isPending}
                            >
                              {uom.isActive ? (
                                <PowerOff className="size-4" aria-hidden />
                              ) : (
                                <Power className="size-4" aria-hidden />
                              )}
                              {uom.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(uom)}
                              disabled={deleteMutation.isPending}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" aria-hidden />
                              Delete
                            </Button>
                          )}
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

      <UomFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        uom={editing}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This unit of measure will be permanently removed. This action
              cannot be undone.
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
