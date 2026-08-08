"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarRange,
  Lock,
  Plus,
  Sparkles,
  Unlock,
} from "lucide-react";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import {
  fiscalYearApi,
  provisioningApi,
  type FiscalYear,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate } from "@/lib/format";
import { FiscalYearFormSheet } from "@/components/accounting/fiscal-year/fiscal-year-form";

function FiscalYearStatus({ fiscalYear }: { fiscalYear: FiscalYear }) {
  if (fiscalYear.isActive) {
    return (
      <Badge className="bg-success/10 text-success hover:bg-success/10">
        Active
      </Badge>
    );
  }
  if (fiscalYear.isClosed) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Closed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Planned
    </Badge>
  );
}

export function FiscalYearTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can("accounting.fiscal-year.create");
  const canUpdate = can("accounting.fiscal-year.update");
  const canClose = can("accounting.fiscal-year.close");

  const [formOpen, setFormOpen] = React.useState(false);
  const [closeTarget, setCloseTarget] = React.useState<FiscalYear | null>(null);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.accounting.fiscalYearList,
    queryFn: () => fiscalYearApi.list(),
  });

  const rows = data ?? [];

  const provisionMutation = useMutation({
    mutationFn: () => provisioningApi.provision(),
    onSuccess: () => {
      toast.success("Accounting setup provisioned.");
      queryClient.invalidateQueries({
        queryKey: ["accounting", "fiscal-years"],
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not provision accounting."));
    },
  });

  const openMutation = useMutation({
    mutationFn: (fiscalYear: FiscalYear) => fiscalYearApi.open(fiscalYear.id),
    onSuccess: (_data, fiscalYear) => {
      toast.success(`Fiscal year ${fiscalYear.name} is now active.`);
      queryClient.invalidateQueries({
        queryKey: ["accounting", "fiscal-years"],
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not open the fiscal year."));
    },
  });

  const closeMutation = useMutation({
    mutationFn: (fiscalYear: FiscalYear) => fiscalYearApi.close(fiscalYear.id),
    onSuccess: (_data, fiscalYear) => {
      toast.success(`Fiscal year ${fiscalYear.name} closed and periods locked.`);
      queryClient.invalidateQueries({
        queryKey: ["accounting", "fiscal-years"],
      });
      setCloseTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not close the fiscal year."));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal years"
        description="BS fiscal years with their twelve periods."
        actions={
          canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New fiscal year
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>All fiscal years</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${rows.length} fiscal year${rows.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {isPending ? (
            <div className="flex flex-col gap-2 px-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <CalendarRange
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <p className="text-sm font-medium">No accounting setup yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Set up accounting to seed the chart of accounts, the first
                fiscal year with twelve periods, and the default tax codes.
              </p>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => provisionMutation.mutate()}
                  disabled={provisionMutation.isPending}
                >
                  {provisionMutation.isPending ? (
                    <Sparkles className="size-4 animate-pulse" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  Set up accounting
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Periods</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((fiscalYear) => (
                  <TableRow key={fiscalYear.id}>
                    <TableCell>
                      <Link
                        href={`/accounting/fiscal-years/${fiscalYear.id}`}
                        className="font-medium hover:underline"
                      >
                        {fiscalYear.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(fiscalYear.startDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(fiscalYear.endDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fiscalYear.periods?.length ?? "—"}
                    </TableCell>
                    <TableCell>
                      <FiscalYearStatus fiscalYear={fiscalYear} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate &&
                          !fiscalYear.isActive &&
                          !fiscalYear.isClosed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openMutation.mutate(fiscalYear)}
                              disabled={openMutation.isPending}
                            >
                              <Unlock className="size-4" aria-hidden />
                              Open
                            </Button>
                          )}
                        {canClose && !fiscalYear.isClosed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCloseTarget(fiscalYear)}
                            disabled={closeMutation.isPending}
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Lock className="size-4" aria-hidden />
                            Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FiscalYearFormSheet open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog
        open={closeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCloseTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Close {closeTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Closing locks all twelve periods. No further journal entries can
              be posted to this fiscal year.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (closeTarget) closeMutation.mutate(closeTarget);
              }}
            >
              {closeMutation.isPending ? "Closing…" : "Close fiscal year"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
