"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Users,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import { userApi, type User } from "@/lib/api/iam";
import { branchApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDateTime } from "@/lib/format";
import { cn, getInitials } from "@/lib/utils";
import { UserFormSheet } from "@/components/iam/user/user-form";

const PAGE_SIZE = 20;

export function UserTable() {
  const { can, user: me } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("iam.user.create");
  const canUpdate = can("iam.user.update");
  const canDelete = can("iam.user.delete");
  const canManageActions = canUpdate || canDelete;

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { data: branchData } = useQuery({
    queryKey: ["accounting", "branches"],
    queryFn: () => branchApi.list(),
  });

  const { data, isPending } = useQuery({
    queryKey: queryKeys.iam.userList({ search, page, limit: PAGE_SIZE }),
    queryFn: () => userApi.list({ search, page, limit: PAGE_SIZE }),
  });

  const total = data?.meta.total ?? 0;
  const branchesById = React.useMemo(
    () => new Map((branchData ?? []).map((branch) => [branch.id, branch])),
    [branchData],
  );

  const toggleMutation = useMutation({
    mutationFn: (user: User) =>
      userApi.update(user.id, { isActive: !user.isActive }),
    onSuccess: (_data, user) => {
      toast.success(
        user.isActive ? "User deactivated." : "User activated.",
      );
      queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the user."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (user: User) => userApi.remove(user.id),
    onSuccess: (_data, user) => {
      toast.success(`User "${user.fullName}" removed.`);
      queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not remove the user."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setFormOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <PageContainer
      icon={Users}
      title="Users"
      description="Team members, their branches and roles."
      actions={
        canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            New user
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All users</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${total} user${total === 1 ? "" : "s"}`}
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
                placeholder="Search by name or email…"
                className="w-56 pl-9"
                aria-label="Search users"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
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
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
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
                        <Users className="size-5 text-muted-foreground" aria-hidden />
                      </span>
                      {search ? (
                        <p className="text-sm font-medium">
                          No users match “{search}”
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No users yet</p>
                          <p className="text-xs text-muted-foreground">
                            Add your first team member to give them access to
                            the system.
                          </p>
                          {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="size-4" aria-hidden />
                              Create user
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((user) => {
                  const isSelf = user.id === me?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(user.fullName || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {user.fullName}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {user.role ? (
                            <span className="text-sm">{user.role.name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                          {user.isOwner && (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              Owner
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {branchesById.get(user.branchId)?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? "default" : "outline"}
                          className={cn(
                            user.isActive &&
                              "bg-success/10 text-success hover:bg-success/10",
                          )}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(user.lastLoginAt)}
                      </TableCell>
                      {canManageActions && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(user)}
                              >
                                <Pencil className="size-4" aria-hidden />
                                Edit
                              </Button>
                            )}
                            {canUpdate && !isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleMutation.mutate(user)}
                                disabled={toggleMutation.isPending}
                              >
                                {user.isActive ? (
                                  <PowerOff className="size-4" aria-hidden />
                                ) : (
                                  <Power className="size-4" aria-hidden />
                                )}
                                {user.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            )}
                            {canDelete && !isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(user)}
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
                  );
                })
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

      <UserFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
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
              Remove {deleteTarget?.fullName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out immediately and can no longer access the
              system. This action cannot be undone.
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
