"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
} from "lucide-react";
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
  brandApi,
  categoryApi,
  itemApi,
  type Item,
} from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ItemFormSheet } from "@/components/trading/item/item-form";

const PAGE_SIZE = 20;

type ActiveFilter = "all" | "active" | "inactive";

const ACTIVE_FILTER_LABELS: Record<ActiveFilter, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

export function ItemTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("trading.item.create");
  const canUpdate = can("trading.item.update");

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("all");
  const [brandId, setBrandId] = React.useState("all");
  const [active, setActive] = React.useState<ActiveFilter>("all");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Item | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const categoryQuery = categoryId;
  const brandQuery = brandId;
  const activeQuery = active === "all" ? undefined : active === "active";

  const { data: filterCategoryData } = useQuery({
    queryKey: queryKeys.trading.categoryList({ limit: 100 }),
    queryFn: () => categoryApi.list({ limit: 100 }),
  });
  const { data: filterBrandData } = useQuery({
    queryKey: queryKeys.trading.brandList({ limit: 100 }),
    queryFn: () => brandApi.list({ limit: 100 }),
  });

  const { data, isPending } = useQuery({
    queryKey: queryKeys.trading.itemList({
      search,
      page,
      limit: PAGE_SIZE,
      categoryId: categoryQuery === "all" ? undefined : categoryQuery,
      brandId: brandQuery === "all" ? undefined : brandQuery,
      isActive: activeQuery,
    }),
    queryFn: () =>
      itemApi.list({
        search,
        page,
        limit: PAGE_SIZE,
        categoryId: categoryQuery === "all" ? undefined : categoryQuery,
        brandId: brandQuery === "all" ? undefined : brandQuery,
        isActive: activeQuery,
      }),
  });

  const total = data?.meta.total ?? 0;

  const toggleMutation = useMutation({
    mutationFn: (item: Item) =>
      itemApi.update(item.id, { isActive: !item.isActive }),
    onSuccess: (_data, item) => {
      toast.success(item.isActive ? "Item deactivated." : "Item activated.");
      queryClient.invalidateQueries({ queryKey: ["trading", "items"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the item."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        description="Products, services and raw materials — pricing, tax and inventory settings."
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New item
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>All items</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} item${total === 1 ? "" : "s"}`}
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
                  placeholder="Search items…"
                  className="w-52 pl-9"
                  aria-label="Search items"
                />
              </div>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(filterCategoryData?.data ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={brandId}
                onValueChange={(value) => {
                  setBrandId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {(filterBrandData?.data ?? []).map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={active}
                onValueChange={(value) => {
                  setActive(value as ActiveFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACTIVE_FILTER_LABELS) as ActiveFilter[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {ACTIVE_FILTER_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Base UOM</TableHead>
                <TableHead className="text-right">Sale price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                {canUpdate && (
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
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    {canUpdate && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-24" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canUpdate ? 9 : 8}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <Package
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No items match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No items yet</p>
                          <p className="text-xs text-muted-foreground">
                            Create your first item, e.g. a product you sell by
                            unit.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create item
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/trading/items/${item.id}`}
                        className="hover:text-accent"
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex flex-col">
                        {item.code || "—"}
                        <span className="text-xs text-muted-foreground/70">
                          {item.sku || ""}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.brand?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.baseUom?.shortName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(item.salePrice)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.isActive ? "default" : "outline"}
                        className={cn(
                          item.isActive &&
                            "bg-success/10 text-success hover:bg-success/10",
                        )}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="ml-1 text-muted-foreground"
                      >
                        {item.type.charAt(0) +
                          item.type.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(item.updatedAt)}
                    </TableCell>
                    {canUpdate && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate(item)}
                            disabled={toggleMutation.isPending}
                          >
                            {item.isActive ? (
                              <PowerOff className="size-4" aria-hidden />
                            ) : (
                              <Power className="size-4" aria-hidden />
                            )}
                            {item.isActive ? "Deactivate" : "Activate"}
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

      <ItemFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editing}
      />
    </div>
  );
}
