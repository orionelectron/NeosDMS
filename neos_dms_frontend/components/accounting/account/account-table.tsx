"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import {
  accountApi,
  COA_TYPES,
  type Account,
  type CoaType,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccountFormSheet } from "@/components/accounting/account/account-form";

const PAGE_SIZE = 100;

const TYPE_FILTERS: { value: CoaType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  ...COA_TYPES.map((type) => ({ value: type, label: type })),
];

export function AccountTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("accounting.account.create");
  const canUpdate = can("accounting.account.update");
  const canDelete = can("accounting.account.delete");
  const canManageActions = canUpdate || canDelete;

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<CoaType | "ALL">("ALL");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Account | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.accounting.accountList({
      search,
      coaType: typeFilter === "ALL" ? undefined : typeFilter,
      page: 1,
      limit: PAGE_SIZE,
    }),
    queryFn: () =>
      accountApi.list({
        search,
        coaType: typeFilter === "ALL" ? undefined : typeFilter,
        page: 1,
        limit: PAGE_SIZE,
      }),
  });

  const total = data?.meta.total ?? 0;

  const toggleMutation = useMutation({
    mutationFn: (account: Account) =>
      accountApi.update(account.id, { isActive: !account.isActive }),
    onSuccess: (_data, account) => {
      toast.success(
        account.isActive ? "Account deactivated." : "Account activated.",
      );
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the account."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (account: Account) => accountApi.remove(account.id),
    onSuccess: (_data, account) => {
      toast.success(`Account "${account.code} ${account.name}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not delete the account."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <PageContainer
      icon={BookOpen}
      title="Chart of accounts"
      description="Accounts the ledger posts to, grouped by type."
      actions={
        canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New account
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All accounts</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} account${total === 1 ? "" : "s"}`}
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
                placeholder="Search by code or name…"
                className="w-64 pl-9"
                aria-label="Search accounts"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <div className="px-6 pb-4">
            <Tabs
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as CoaType | "ALL")
              }
            >
              <TabsList>
                {TYPE_FILTERS.map((filter) => (
                  <TabsTrigger key={filter.value} value={filter.value}>
                    {filter.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
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
                      <Skeleton className="h-4 w-14" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
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
                        <Wallet
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      {search || typeFilter !== "ALL" ? (
                        <p className="text-sm font-medium">
                          No accounts match your filters.
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">
                            No accounts yet
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Create your first account, e.g. Cash in Hand under
                            Assets.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create account
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((account) => {
                  const protectedAccount =
                    account.isSystemAccount || account.isLocked;
                  const indent = (account.level ?? 1) * 20;
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {account.code}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-1.5 font-medium"
                          style={{ paddingLeft: `${indent}px` }}
                        >
                          {account.isGroup && (
                            <ChevronDown
                              className="size-4 shrink-0 text-muted-foreground/60"
                              aria-hidden
                            />
                          )}
                          <span>{account.name}</span>
                          {account.isGroup && (
                            <Badge variant="outline" className="ml-1">
                              Group
                            </Badge>
                          )}
                          {protectedAccount && (
                            <Lock
                              className="size-3.5 text-muted-foreground/60"
                              aria-label="System account"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.coaType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.isActive ? "default" : "outline"}
                          className={cn(
                            account.isActive &&
                              "bg-success/10 text-success hover:bg-success/10",
                          )}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(account.updatedAt)}
                      </TableCell>
                      {canManageActions && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {protectedAccount ? (
                              <span className="pr-3 text-xs text-muted-foreground">
                                System
                              </span>
                            ) : (
                              <>
                                {canUpdate && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEdit(account)}
                                  >
                                    <Pencil className="size-4" aria-hidden />
                                    Edit
                                  </Button>
                                )}
                                {canUpdate && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      toggleMutation.mutate(account)
                                    }
                                    disabled={toggleMutation.isPending}
                                  >
                                    {account.isActive ? (
                                      <PowerOff className="size-4" aria-hidden />
                                    ) : (
                                      <Power className="size-4" aria-hidden />
                                    )}
                                    {account.isActive
                                      ? "Deactivate"
                                      : "Activate"}
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget(account)}
                                    disabled={deleteMutation.isPending}
                                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="size-4" aria-hidden />
                                    Delete
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
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
              Delete {deleteTarget?.code} {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Only unused leaf accounts can be deleted. If the account has
              journal entries or child accounts, the system will refuse.
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
