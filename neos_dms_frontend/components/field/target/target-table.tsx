"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Target, Trash2 } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import {
  salesTargetApi,
  type SalesTarget,
  type SalesTargetType,
} from "@/lib/api/field";
import { queryKeys } from "@/lib/query/keys";
import { formatMoney, formatDate } from "@/lib/format";
import { getInitials } from "@/lib/utils";
import { SalesTargetFormSheet } from "@/components/field/target/target-form";

const TARGET_TYPE_LABEL: Record<SalesTargetType, string> = {
  PERSONAL: "Personal",
  CATEGORY: "Category",
  BRAND: "Brand",
};

export function TargetTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("sales.target.create");
  const canDelete = can("sales.target.delete");
  const canManageActions = canDelete;

  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<SalesTarget | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.field.salesTargetList({}),
    queryFn: () => salesTargetApi.listAll({}),
  });

  const deleteMutation = useMutation({
    mutationFn: (target: SalesTarget) => salesTargetApi.remove(target.id),
    onSuccess: () => {
      toast.success("Target removed.");
      queryClient.invalidateQueries({ queryKey: ["field", "targets"] });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not remove the target."));
    },
  });

  const rows = (data ?? []).slice().sort((a, b) => {
    if (a.bsYear !== b.bsYear) return b.bsYear - a.bsYear;
    if (a.bsMonth !== b.bsMonth) return b.bsMonth - a.bsMonth;
    return a.user.fullName.localeCompare(b.user.fullName);
  });

  return (
    <PageContainer
      icon={Target}
      title="Sales targets"
      description="Monthly sales targets for your team, by personal sales, category, or brand."
      actions={
        canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Set target
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All targets</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${rows.length} target${rows.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Amount</TableHead>
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
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
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
                    colSpan={canManageActions ? 7 : 6}
                    className="h-40 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <Target
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </span>
                      <p className="text-sm font-medium">No targets yet</p>
                      <p className="text-xs text-muted-foreground">
                        Set a monthly sales target for your team.
                      </p>
                      {canCreate && (
                        <Button size="sm" onClick={() => setFormOpen(true)}>
                          <Plus className="size-4" aria-hidden />
                          Set target
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(
                              target.user.fullName || target.user.email,
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {target.user.fullName}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {target.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {target.bsYear} / {String(target.bsMonth).padStart(2, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline">
                          {TARGET_TYPE_LABEL[target.targetType]}
                        </Badge>
                        {target.targetType === "CATEGORY" &&
                          target.category && (
                            <span className="text-xs text-muted-foreground">
                              {target.category.name}
                            </span>
                          )}
                        {target.targetType === "BRAND" && target.brand && (
                          <span className="text-xs text-muted-foreground">
                            {target.brand.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(target.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={target.isActive ? "secondary" : "outline"}
                      >
                        {target.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(target.updatedAt)}
                    </TableCell>
                    {canManageActions && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(target)}
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
      </Card>

      <SalesTargetFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this target?</AlertDialogTitle>
            <AlertDialogDescription>
              The{" "}
              {deleteTarget
                ? `${TARGET_TYPE_LABEL[deleteTarget.targetType].toLowerCase()} target for ${deleteTarget.user.fullName}`
                : ""}{" "}
              will be removed. This action cannot be undone.
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
