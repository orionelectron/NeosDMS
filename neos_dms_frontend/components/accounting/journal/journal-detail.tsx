"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Ban, Loader2, ScrollText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { PageContainer } from "@/components/app-shell/page-container";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import { journalApi, type JournalEntry } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

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

interface JournalDetailProps {
  id: string;
}

export function JournalDetail({ id }: JournalDetailProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const canPost = can("accounting.journal-entry.post");
  const canCancel = can("accounting.journal-entry.delete");

  const { data: entry, isLoading } = useQuery({
    queryKey: queryKeys.accounting.journalDetail(id),
    queryFn: () => journalApi.get(id),
  });

  const postMutation = useMutation({
    mutationFn: () => journalApi.post(id),
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
    mutationFn: () => journalApi.cancel(id),
    onSuccess: () => {
      toast.success("Journal entry cancelled.");
      queryClient.invalidateQueries({
        queryKey: ["accounting", "journal-entries"],
      });
      setCancelOpen(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not cancel the journal entry."));
    },
  });

  if (isLoading || !entry) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalDebit = entry.lines.reduce(
    (sum, line) => sum + Number(line.debitAmount),
    0,
  );
  const totalCredit = entry.lines.reduce(
    (sum, line) => sum + Number(line.creditAmount),
    0,
  );

  return (
    <PageContainer
      icon={ScrollText}
      title={entry.referenceNumber ?? "Draft journal entry"}
      description={`Created ${formatDateTime(entry.createdAt)}`}
      actions={<StatusBadge status={entry.status} />}
    >
      <Button variant="ghost" size="sm" asChild>
        <Link href="/accounting/journal-entries">
          <ArrowLeft className="size-4" aria-hidden />
          Back to journal entries
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Entry date</dt>
              <dd className="font-medium">{formatDate(entry.entryDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fiscal year</dt>
              <dd className="font-medium">
                {entry.fiscalYear?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Period</dt>
              <dd className="font-medium">
                {entry.fiscalPeriod?.name ?? "—"}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="font-medium">{entry.description ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
          {entry.status === "DRAFT" && (
            <CardAction>
              <div className="flex gap-2">
                {canPost && (
                  <Button
                    size="sm"
                    onClick={() => postMutation.mutate()}
                    disabled={postMutation.isPending}
                  >
                    {postMutation.isPending && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    <Send className="size-4" aria-hidden />
                    Post entry
                  </Button>
                )}
                {canCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground"
                    onClick={() => setCancelOpen(true)}
                    disabled={cancelMutation.isPending}
                  >
                    <Ban className="size-4" aria-hidden />
                    Cancel
                  </Button>
                )}
              </div>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="font-medium">
                        {line.account.code} — {line.account.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {line.account.coaType}
                      </div>
                    </TableCell>
                    <TableCell>{line.party?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.debitAmount) > 0
                        ? formatMoney(Number(line.debitAmount))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.creditAmount) > 0
                        ? formatMoney(Number(line.creditAmount))
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell colSpan={3} className="text-right">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(totalCredit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft will be marked as cancelled and can no longer be
              posted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => cancelMutation.mutate()}
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
