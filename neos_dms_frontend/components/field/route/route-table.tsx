"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Route as RouteIcon, Search, Trash2, Upload } from "lucide-react";
import { PageContainer } from "@/components/app-shell/page-container";
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
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import { routeApi, type Route } from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RouteFormSheet } from "@/components/field/route/route-form";
import { ImportDialog } from "@/components/field/import/import-dialog";

const PAGE_SIZE = 20;

export function RouteTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("sales.route.create");
  const canUpdate = can("sales.route.update");
  const canDelete = can("sales.route.delete");
  const canManageActions = canUpdate || canDelete;

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Route | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Route | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.field.routeList({
      search,
      status: status === "ALL" ? undefined : (status as Route["status"]),
      page,
      limit: PAGE_SIZE,
    }),
    queryFn: () =>
      routeApi.list({
        search,
        status: status === "ALL" ? undefined : (status as Route["status"]),
        page,
        limit: PAGE_SIZE,
      }),
  });

  const total = data?.meta.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (route: Route) => routeApi.remove(route.id),
    onSuccess: (_data, route) => {
      toast.success(`Route "${route.name}" removed.`);
      queryClient.invalidateQueries({ queryKey: ["field", "routes"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not remove the route."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(route: Route) {
    setEditing(route);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <PageContainer
      icon={RouteIcon}
      title="Routes"
      description="Delivery routes that group outlets and can be assigned to salespeople."
      actions={
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New route
            </Button>
          )}
          {canCreate && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" aria-hidden />
              Import
            </Button>
          )}
        </div>
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All routes</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} route${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex items-center gap-2">
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search routes…"
                  className="w-52 pl-9"
                  aria-label="Search routes"
                />
              </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                {canManageActions && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
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
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
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
                  <TableCell
                    colSpan={canManageActions ? 6 : 5}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <RouteIcon
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No routes match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No routes yet</p>
                          <p className="text-xs text-muted-foreground">
                            Create your first route, then link outlets to it.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create route
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {route.code}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {route.district
                        ? [route.district, route.province]
                            .filter(Boolean)
                            .join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={route.status === "ACTIVE" ? "default" : "outline"}
                        className={cn(
                          route.status === "ACTIVE" &&
                            "bg-success/10 text-success hover:bg-success/10",
                        )}
                      >
                        {route.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(route.updatedAt)}
                    </TableCell>
                    {canManageActions && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(route)}
                            >
                              <Pencil className="size-4" aria-hidden />
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(route)}
                              disabled={deleteMutation.isPending}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" aria-hidden />
                              Remove
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

      <RouteFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        route={editing}
      />

      <ImportDialog
        key={importOpen ? "open" : "closed"}
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import routes"
        description="Upload a spreadsheet to create or update routes in bulk. Download the template for the expected columns."
        importFile={routeApi.import}
        getTemplate={routeApi.importTemplate}
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
              Remove {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The route and its outlet links will be removed. Assignments and
              visits referencing it will be affected. This action cannot be
              undone.
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
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
