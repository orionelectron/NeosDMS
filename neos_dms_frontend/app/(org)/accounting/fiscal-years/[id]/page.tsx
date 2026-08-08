"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fiscalYearApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { formatDate } from "@/lib/format";
import { PeriodsTable } from "@/components/accounting/fiscal-year/periods-table";

export default function FiscalYearDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.accounting.fiscalYearDetail(params.id),
    queryFn: () => fiscalYearApi.get(params.id),
  });

  const fiscalYear = data;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <Link
          href="/accounting/fiscal-years"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Fiscal years
        </Link>
        <PageHeader
          title={fiscalYear?.name ?? "Fiscal year"}
          description={
            fiscalYear
              ? `${formatDate(fiscalYear.startDate)} – ${formatDate(fiscalYear.endDate)}`
              : "Loading…"
          }
        />
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        fiscalYear && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Start date</CardDescription>
                <CardTitle className="text-lg">
                  {formatDate(fiscalYear.startDate)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>End date</CardDescription>
                <CardTitle className="text-lg">
                  {formatDate(fiscalYear.endDate)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-lg">
                  {fiscalYear.isActive ? (
                    <Badge className="bg-success/10 text-success hover:bg-success/10">
                      Active
                    </Badge>
                  ) : fiscalYear.isClosed ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      Closed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Planned
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )
      )}

      <PeriodsTable fiscalYearId={params.id} />
    </div>
  );
}
