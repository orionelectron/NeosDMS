"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Power, PowerOff, Search, Users } from "lucide-react";
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
import {
  TablePagination,
} from "@/components/ui/table-pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/app-shell/page-container";
import { getErrorMessage } from "@/lib/api/http";
import { partyApi, type Party } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { PartyFormSheet } from "@/components/accounting/party/party-form";

const ROLE_FILTERS = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "supplier", label: "Suppliers" },
  { value: "lead", label: "Leads" },
] as const;

function roleLabels(party: Party): string[] {
  const roles: string[] = [];
  if (party.isCustomer) roles.push("Customer");
  if (party.isSupplier) roles.push("Supplier");
  if (party.isLead) roles.push("Lead");
  return roles;
}

export function PartyTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [role, setRole] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Party | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = {
    page,
    limit: 10,
    search: debounced,
    role: role === "all" ? undefined : role,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.accounting.partyList(query),
    queryFn: () => partyApi.list(query),
  });

  const toggleMutation = useMutation({
    mutationFn: (target: Party) =>
      partyApi.update(target.id, { isActive: !target.isActive }),
    onSuccess: (_data, target) => {
      toast.success(target.isActive ? "Party deactivated." : "Party activated.");
      queryClient.invalidateQueries({ queryKey: ["accounting", "parties"] });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not update the party."));
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(party: Party) {
    setEditing(party);
    setFormOpen(true);
  }

  return (
    <PageContainer
      icon={Users}
      title="Parties"
      description="Customers, suppliers and leads with contact details and credit terms."
      actions={
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Add party
        </Button>
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>All parties</CardTitle>
            <CardDescription>
              {isLoading
                ? "Loading…"
                : `${data?.meta.total ?? 0} party${(data?.meta.total ?? 0) === 1 ? "" : "ies"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={role} onValueChange={setRole}>
                <TabsList>
                  {ROLE_FILTERS.map((filter) => (
                    <TabsTrigger key={filter.value} value={filter.value}>
                      {filter.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search parties"
                  className="w-56 pl-8"
                />
              </div>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>PAN / VAT</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 6 }).map((_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (data?.data.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground">
                    No parties found. Add your first customer, supplier or lead.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((party) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <div className="font-medium">{party.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {party.partyKind}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {roleLabels(party).map((roleName) => (
                        <Badge key={roleName} variant="secondary">
                          {roleName}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{party.panNumber ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {party.vatNumber ?? "—"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{party.phone ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {party.email ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(party)}
                        title="Edit"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleMutation.mutate(party)}
                        disabled={toggleMutation.isPending}
                        title={party.isActive ? "Deactivate" : "Activate"}
                        className="text-muted-foreground"
                      >
                        {toggleMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : party.isActive ? (
                          <Power className="size-4" aria-hidden />
                        ) : (
                          <PowerOff className="size-4" aria-hidden />
                        )}
                      </Button>
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

      <PartyFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        party={editing}
      />
    </PageContainer>
  );
}
