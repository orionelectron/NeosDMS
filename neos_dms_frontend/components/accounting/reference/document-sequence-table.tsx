"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Hash, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
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
import { PageContainer } from "@/components/app-shell/page-container";
import { useAuth } from "@/components/providers/auth-provider";
import { documentSequenceApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate } from "@/lib/format";
import { DocumentSequenceFormSheet } from "@/components/accounting/reference/document-sequence-form";

function typeLabel(documentType: string): string {
  return documentType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function DocumentSequenceTable() {
  const { can } = useAuth();
  const [formOpen, setFormOpen] = React.useState(false);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.accounting.documentSequenceList,
    queryFn: () => documentSequenceApi.list(),
  });

  const canCreate = can("accounting.document-sequence.create");

  return (
    <PageContainer
      icon={Hash}
      title="Document sequences"
      description="Running numbering for invoices, journals and other documents."
      actions={
        canCreate ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New sequence
          </Button>
        ) : undefined
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All sequences</CardTitle>
            <CardDescription>
              {isPending
                ? "Loading…"
                : `${data?.length ?? 0} sequence${(data?.length ?? 0) === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document type</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead className="text-right">Next number</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Fiscal year</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 6 }).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (data?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground">
                    No document sequences yet. Create one to control numbering.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data?.map((sequence) => (
                <TableRow key={sequence.id}>
                  <TableCell className="font-medium">
                    {typeLabel(sequence.documentType)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {sequence.prefix ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {sequence.prefix ?? ""}
                    {String(sequence.lastNumber + 1).padStart(6, "0")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sequence.branchId ? "Scoped" : "Global"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sequence.fiscalYearId ? "Scoped" : "Global"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(sequence.updatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      <DocumentSequenceFormSheet open={formOpen} onOpenChange={setFormOpen} />
    </PageContainer>
  );
}
