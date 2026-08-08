"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus, Power, PowerOff, Search, Trash2 } from "lucide-react";
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
import { categoryApi, type ItemCategory } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryFormSheet } from "@/components/trading/category/category-form";

const PAGE_SIZE = 20;

export function CategoryTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("trading.item-category.create");
  const canUpdate = can("trading.item-category.update");
  const canDelete = can("trading.item-category.delete");
  const canManageActions = canUpdate || canDelete;

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ItemCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ItemCategory | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.trading.categoryList({ search, page, limit: PAGE_SIZE }),
    queryFn: () => categoryApi.list({ search, page, limit: PAGE_SIZE }),
  });

  const total = data?.meta.total ?? 0;

  const toggleMutation = useMutation({
    mutationFn: (category: ItemCategory) =>
      categoryApi.update(category.id, { isActive: !category.isActive }),
    onSuccess: (_data, category) => {
      toast.success(
        category.isActive ? "Category deactivated." : "Category activated.",
      );
      queryClient.invalidateQueries({ queryKey: ["trading", "categories"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the category."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (category: ItemCategory) => categoryApi.remove(category.id),
    onSuccess: (_data, category) => {
      toast.success(`Category "${category.name}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ["trading", "categories"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not delete the category."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: ItemCategory) {
    setEditing(category);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <PageContainer
      icon={FolderTree}
      title="Item categories"
      description="Group items into a hierarchy for reporting and pricing."
      actions={
        canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New category
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All categories</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} categor${total === 1 ? "y" : "ies"}`}
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
                placeholder="Search categories…"
                className="w-56 pl-9"
                aria-label="Search categories"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Parent</TableHead>
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
                      <Skeleton className="h-4 w-12" />
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
                        <FolderTree
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No categories match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">
                            No categories yet
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Create your first category, e.g. Beverages or
                            Electronics.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create category
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.code || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.parentCategory?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={category.isActive ? "default" : "outline"}
                        className={cn(
                          category.isActive &&
                            "bg-success/10 text-success hover:bg-success/10",
                        )}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(category.updatedAt)}
                    </TableCell>
                    {canManageActions && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(category)}
                            >
                              <Pencil className="size-4" aria-hidden />
                              Edit
                            </Button>
                          )}
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMutation.mutate(category)}
                              disabled={toggleMutation.isPending}
                            >
                              {category.isActive ? (
                                <PowerOff className="size-4" aria-hidden />
                              ) : (
                                <Power className="size-4" aria-hidden />
                              )}
                              {category.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(category)}
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

      <CategoryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
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
              This category will be permanently removed. Child categories and
              items referencing it will be unlinked. This action cannot be
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
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
