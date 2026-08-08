"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Power, PowerOff, Search, Tags } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
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
import { brandApi, type Brand } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BrandFormSheet } from "@/components/trading/brand/brand-form";

const PAGE_SIZE = 20;

export function BrandTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("trading.brand.create");
  const canUpdate = can("trading.brand.update");

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Brand | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.trading.brandList({ search, page, limit: PAGE_SIZE }),
    queryFn: () => brandApi.list({ search, page, limit: PAGE_SIZE }),
  });

  const total = data?.meta.total ?? 0;

  const toggleMutation = useMutation({
    mutationFn: (brand: Brand) =>
      brandApi.update(brand.id, { isActive: !brand.isActive }),
    onSuccess: (_data, brand) => {
      toast.success(brand.isActive ? "Brand deactivated." : "Brand activated.");
      queryClient.invalidateQueries({ queryKey: ["trading", "brands"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the brand."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        description="Brands you distribute, assigned to items as needed."
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New brand
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>All brands</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} brand${total === 1 ? "" : "s"}`}
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
                placeholder="Search brands…"
                className="w-56 pl-9"
                aria-label="Search brands"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                {canUpdate && <TableHead className="text-right">Actions</TableHead>}
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
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    {canUpdate && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-16" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canUpdate ? 4 : 3} className="h-40 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <Tags className="size-5 text-muted-foreground" aria-hidden />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No brands match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No brands yet</p>
                          <p className="text-xs text-muted-foreground">
                            Create your first brand, e.g. Acme or Orion.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create brand
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={brand.isActive ? "default" : "outline"}
                        className={cn(
                          brand.isActive &&
                            "bg-success/10 text-success hover:bg-success/10",
                        )}
                      >
                        {brand.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(brand.updatedAt)}
                    </TableCell>
                    {canUpdate && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(brand)}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate(brand)}
                            disabled={toggleMutation.isPending}
                          >
                            {brand.isActive ? (
                              <PowerOff className="size-4" aria-hidden />
                            ) : (
                              <Power className="size-4" aria-hidden />
                            )}
                            {brand.isActive ? "Deactivate" : "Activate"}
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

      <BrandFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        brand={editing}
      />
    </div>
  );
}
