"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Numbering sequences used to assign document numbers at posting time.
        </p>
        {canCreate && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New sequence
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
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
      </div>

      <DocumentSequenceFormSheet open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
