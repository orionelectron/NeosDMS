"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from "lucide-react";
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
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  INVENTORY_LOCATION_TYPES,
  locationApi,
  type InventoryLocation,
  type InventoryLocationType,
} from "@/lib/api/inventory";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LocationFormSheet } from "@/components/inventory/location/location-form";

const PAGE_SIZE = 20;

const LOCATION_TYPE_LABELS: Record<string, string> = {
  GODOWN: "Godown",
  VAN: "Van",
  SHOP: "Shop",
  WAREHOUSE: "Warehouse",
};

export function LocationTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("inventory.location.create");
  const canUpdate = can("inventory.location.update");
  const canDelete = can("inventory.location.delete");

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [locationType, setLocationType] = React.useState<
    "all" | InventoryLocationType
  >("all");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InventoryLocation | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<InventoryLocation | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const typeQuery =
    locationType === "all" ? undefined : locationType;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.inventory.locationList({
      search,
      page,
      limit: PAGE_SIZE,
      locationType: typeQuery,
    }),
    queryFn: () =>
      locationApi.list({
        search,
        page,
        limit: PAGE_SIZE,
        locationType: typeQuery,
      }),
  });

  const total = data?.meta.total ?? 0;
  const rows = data?.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: (location: InventoryLocation) =>
      locationApi.update(location.id, { isActive: !location.isActive }),
    onSuccess: (_data, location) => {
      toast.success(
        location.isActive ? "Location deactivated." : "Location activated.",
      );
      queryClient.invalidateQueries({ queryKey: ["inventory", "locations"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the location."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (location: InventoryLocation) => locationApi.remove(location.id),
    onSuccess: (_data, location) => {
      toast.success(`Location “${location.name}” removed.`);
      queryClient.invalidateQueries({ queryKey: ["inventory", "locations"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not delete the location."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(location: InventoryLocation) {
    setEditing(location);
    setFormOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Locations"
        description="Godowns, vans, shops and warehouses that hold stock."
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New location
            </Button>
          ) : undefined
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All locations</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} location${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search locations…"
                  className="w-52 pl-9"
                  aria-label="Search locations"
                />
              </div>
              <Select
                value={locationType}
                onValueChange={(value) => {
                  setLocationType(value as "all" | InventoryLocationType);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {INVENTORY_LOCATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LOCATION_TYPE_LABELS[type]}
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
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                {(canUpdate || canDelete) && (
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
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    {(canUpdate || canDelete) && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-24" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canUpdate || canDelete ? 7 : 6}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <MapPin
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No locations match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No locations yet</p>
                          <p className="text-xs text-muted-foreground">
                            Add a godown or shop to start tracking stock.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create location
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {location.name}
                        {location.isDefault && (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Default
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.code}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {LOCATION_TYPE_LABELS[location.locationType]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.address ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={location.isActive ? "default" : "outline"}
                        className={cn(
                          location.isActive &&
                            "bg-success/10 text-success hover:bg-success/10",
                        )}
                      >
                        {location.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(location.updatedAt)}
                    </TableCell>
                    {(canUpdate || canDelete) && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(location)}
                              >
                                <Pencil className="size-4" aria-hidden />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleMutation.mutate(location)}
                                disabled={toggleMutation.isPending}
                              >
                                {location.isActive ? (
                                  <PowerOff className="size-4" aria-hidden />
                                ) : (
                                  <Power className="size-4" aria-hidden />
                                )}
                                {location.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(location)}
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

      <LocationFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        location={editing}
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
              This location will be removed from the list. Existing stock
              history is kept.
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
