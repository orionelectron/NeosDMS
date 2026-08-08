"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { taxApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

function IrdBadge({ category }: { category: string }) {
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {category}
    </Badge>
  );
}

export function TaxReference() {
  const { data: types, isPending: typesPending } = useQuery({
    queryKey: queryKeys.accounting.taxReference,
    queryFn: () => taxApi.types(),
  });
  const { data: templates, isPending: templatesPending } = useQuery({
    queryKey: queryKeys.accounting.taxReference,
    queryFn: () => taxApi.templates(),
  });
  const { data: codes, isPending: codesPending } = useQuery({
    queryKey: queryKeys.accounting.taxReference,
    queryFn: () => taxApi.codes(),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>System tax types</CardTitle>
          <CardDescription>
            The types of tax the system understands.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typesPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Sign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(types ?? []).map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.code}</TableCell>
                      <TableCell>{type.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {type.mathSign === 1 ? "+" : "−"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax templates</CardTitle>
          <CardDescription>
            System templates that define how tax lines are applied.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templatesPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>IRD category</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Origin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(templates ?? []).map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell>
                        <IrdBadge category={template.irdCategory} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {template.rate}%
                      </TableCell>
                      <TableCell>
                        {template.isSystem ? (
                          <Badge className="bg-success/10 text-success hover:bg-success/10">
                            System
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Custom
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax codes</CardTitle>
          <CardDescription>
            The organization&apos;s VAT and TDS codes linked to ledger accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codesPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>IRD category</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Linked account</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(codes ?? []).map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-medium">{code.name}</TableCell>
                      <TableCell>
                        <IrdBadge category={code.irdCategory} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {code.rate}%
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {code.account
                          ? `${code.account.code} — ${code.account.name}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={code.isActive ? "secondary" : "outline"}
                          className={cn(
                            code.isActive
                              ? "text-success"
                              : "text-muted-foreground",
                          )}
                        >
                          {code.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
