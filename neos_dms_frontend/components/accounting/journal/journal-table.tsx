"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, Loader2, Plus, ScrollText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/app-shell/page-container";
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
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import {
  journalApi,
  type JournalEntry,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate, formatMoney } from "@/lib/format";
import { JournalFormSheet } from "@/components/accounting/journal/journal-form";

const STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

function StatusBadge({ status }: { status: JournalEntry["status"] }) {
  if (status === "POSTED") {
    return (
      <Badge className="bg-success/10 text-success hover:bg-success/10">
        Posted
      </Badge>
    );
  }
  if (status === "CANCELLED") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <span className="text-muted-foreground">Draft</span>
    </Badge>
  );
}

function entryTotal(entry: JournalEntry): number {
  return entry.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
}

export function JournalTable() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<string>("ALL");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<JournalEntry | null>(
    null,
  );

  const canCreate = can("accounting.journal-entry.create");
  const canPost = can("accounting.journal-entry.post");
  const canCancel = can("accounting.journal-entry.delete");

  const query = {
    page,
    limit: 10,
    status: status === "ALL" ? undefined : (status as JournalEntry["status"]),
    from: from === "" ? undefined : from,
    to: to === "" ? undefined : to,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.accounting.journalList(query),
    queryFn: () => journalApi.list(query),
  });

  const postMutation = useMutation({
    mutationFn: (entry: JournalEntry) => journalApi.post(entry.id),
    onSuccess: (posted) => {
      toast.success(
        `Journal posted as ${posted.referenceNumber ?? "JE"}.`,
      );
      queryClient.invalidateQueries({
        queryKey: ["accounting", "journal-entries"],
      });
      queryClient.invalidateQueries({
        queryKey: ["accounting", "trial-balance"],
      });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not post the journal entry."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (entry: JournalEntry) => journalApi.cancel(entry.id),
    onSuccess: () => {
      toast.success("Journal entry cancelled.");
      queryClient.invalidateQueries({
        queryKey: ["accounting", "journal-entries"],
      });
      setCancelTarget(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not cancel the journal entry."));
    },
  });

  return (
    <PageContainer
      icon={ScrollText}
      title="Journal entries"
      description="Draft, post and cancel balanced journal entries posted to the ledger."
      actions={
        canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New entry
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All entries</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading…"
                : `${data?.meta.total ?? 0} journal entries`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={status} onValueChange={setStatus}>
                <TabsList>
                  {STATUS_TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2 text-sm">
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-40"
                  aria-label="From date"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-40"
                  aria-label="To date"
                />
              </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (data?.data.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground">
                    No journal entries found.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((entry) => (
                <TableRow key={entry.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={`/accounting/journal-entries/${entry.id}`}
                      className="hover:underline"
                    >
                      {entry.referenceNumber ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(entry.entryDate)}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {entry.description ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={entry.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.lines.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(entryTotal(entry))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {entry.status === "DRAFT" && canPost && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => postMutation.mutate(entry)}
                          disabled={postMutation.isPending}
                        >
                          <Send className="size-4" aria-hidden />
                          Post
                        </Button>
                      )}
                      {entry.status === "DRAFT" && canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => setCancelTarget(entry)}
                          disabled={cancelMutation.isPending}
                        >
                          <Ban className="size-4" aria-hidden />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </CardContent>
        <CardFooter className="shrink-0 border-t px-5 py-3">
          {data && (data.meta.total > 0 || data.data.length > 0) && (
            <TablePagination
              page={page}
              pageSize={data.meta.limit}
              total={data.meta.total}
              onPageChange={setPage}
            />
          )}
        </CardFooter>
      </Card>

      <JournalFormSheet open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft {cancelTarget?.referenceNumber ?? "entry"} will be
              marked as cancelled and can no longer be posted. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) cancelMutation.mutate(cancelTarget);
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Cancel entry
            </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </PageContainer>
  );
}
