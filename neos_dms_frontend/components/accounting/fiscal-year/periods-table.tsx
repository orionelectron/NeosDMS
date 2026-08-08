"use client";

import { useQuery } from "@tanstack/react-query";
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
import { fiscalYearApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PeriodsTable({ fiscalYearId }: { fiscalYearId: string }) {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.accounting.fiscalYearDetail(fiscalYearId),
    queryFn: () => fiscalYearApi.periods(fiscalYearId),
  });

  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Periods</CardTitle>
          <CardDescription>
            {isPending ? "Loading…" : `${rows.length} fiscal periods`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Month (BS)</TableHead>
              <TableHead>Start (AD)</TableHead>
              <TableHead>End (AD)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground">
                    No periods found.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="text-muted-foreground">
                    {period.sequence}
                  </TableCell>
                  <TableCell className="font-medium">
                    {period.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(period.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(period.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={period.isLocked ? "outline" : "default"}
                      className={cn(
                        !period.isLocked &&
                          "bg-success/10 text-success hover:bg-success/10",
                      )}
                    >
                      {period.isLocked ? "Locked" : "Open"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
