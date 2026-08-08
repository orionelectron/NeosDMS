"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, ShieldAlert, ScrollText } from "lucide-react";
import { PageContainer } from "@/components/app-shell/page-container";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { useAuth } from "@/components/providers/auth-provider";
import {
  auditLogApi,
  permissionApi,
  userApi,
  type AuditLog,
} from "@/lib/api/iam";
import { queryKeys } from "@/lib/query/keys";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const ALL = "all";

function actionVerb(action: string): string {
  const verb = action.split(".").pop() ?? action;
  return verb.charAt(0).toUpperCase() + verb.slice(1).replace(/[-_]/g, " ");
}

function actionBadgeClass(action: string): string {
  if (
    action.endsWith(".delete") ||
    action.endsWith(".cancel") ||
    action.endsWith(".reject")
  ) {
    return "border-transparent bg-destructive/10 text-destructive";
  }
  if (action.endsWith(".create")) {
    return "border-transparent bg-success/10 text-success";
  }
  if (action.endsWith(".update")) {
    return "border-transparent bg-muted text-foreground";
  }
  return "";
}

export function AuditLogTable() {
  const { can } = useAuth();
  const canReadAudit = can("iam.audit-log.read");
  const canReadCatalog = can("iam.permission.read");
  const canReadUsers = can("iam.user.read");

  const [action, setAction] = React.useState(ALL);
  const [userId, setUserId] = React.useState(ALL);
  const [page, setPage] = React.useState(1);
  const [detailTarget, setDetailTarget] = React.useState<AuditLog | null>(null);

  const { data: catalog } = useQuery({
    queryKey: queryKeys.iam.permissionCatalog,
    queryFn: () => permissionApi.list(),
    enabled: canReadAudit && canReadCatalog,
  });

  const { data: users } = useQuery({
    queryKey: queryKeys.iam.userList({ page: 1, limit: 100 }),
    queryFn: () => userApi.list({ page: 1, limit: 100 }),
    enabled: canReadAudit && canReadUsers,
  });

  const { data, isPending } = useQuery({
    queryKey: queryKeys.iam.auditLogList({
      page,
      limit: PAGE_SIZE,
      action: action === ALL ? undefined : action,
      userId: userId === ALL ? undefined : userId,
    }),
    queryFn: () =>
      auditLogApi.list({
        page,
        limit: PAGE_SIZE,
        action: action === ALL ? undefined : action,
        userId: userId === ALL ? undefined : userId,
      }),
    enabled: canReadAudit,
  });

  const rows = React.useMemo(() => data?.data ?? [], [data]);
  const total = data?.meta.total ?? 0;

  const usersById = React.useMemo(
    () => new Map((users?.data ?? []).map((user) => [user.id, user])),
    [users],
  );

  const actionOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const group of catalog ?? []) {
      for (const code of group.permissions) seen.add(code);
    }
    for (const row of rows) seen.add(row.action);
    return Array.from(seen).sort();
  }, [catalog, rows]);

  const userOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const user of users?.data ?? []) seen.set(user.id, user.fullName);
    for (const row of rows) {
      if (row.userId && !seen.has(row.userId)) seen.set(row.userId, "Unknown user");
    }
    return Array.from(seen.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [users, rows]);

  if (!canReadAudit) {
    return (
      <PageContainer
        icon={ScrollText}
        title="Audit log"
        description="A record of who changed what, and when."
      >
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <p className="text-sm font-medium">No access</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              You need the iam.audit-log.read permission to view the audit log.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      icon={ScrollText}
      title="Audit log"
      description="A record of who changed what, and when."
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <CardHeader className="shrink-0 px-5 py-4">
          <div>
            <CardTitle>Activity log</CardTitle>
            <CardDescription>
              {isPending ? "Loading…" : `${total} event${total === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={action} onValueChange={(value) => { setAction(value); setPage(1); }}>
                <SelectTrigger className="w-52" aria-label="Filter by action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All actions</SelectItem>
                  {actionOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {actionVerb(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={userId} onValueChange={(value) => { setUserId(value); setPage(1); }}>
                <SelectTrigger className="w-44" aria-label="Filter by user">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All users</SelectItem>
                  {userOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6">
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <ScrollText className="size-5 text-muted-foreground" aria-hidden />
                      </span>
                      {action !== ALL || userId !== ALL ? (
                        <p className="text-sm font-medium">
                          No events match the current filters
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium">No activity yet</p>
                          <p className="text-xs text-muted-foreground">
                            Changes made across the system will show up here.
                          </p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((log) => {
                  const user = log.userId ? usersById.get(log.userId) : null;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <p>{formatDateTime(log.occurredAt)}</p>
                        {log.bsDate && (
                          <p className="text-xs text-muted-foreground">
                            BS {formatDate(log.bsDate)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-border",
                              actionBadgeClass(log.action),
                            )}
                          >
                            {actionVerb(log.action)}
                          </Badge>
                          <span className="hidden max-w-40 truncate font-mono text-xs text-muted-foreground xl:inline" title={log.action}>
                            {log.action}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{log.entityType}</p>
                        {log.entityId && (
                          <p className="font-mono text-xs text-muted-foreground">
                            {log.entityId.slice(0, 8)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {user ? user.fullName : log.userId ? "Unknown user" : "System"}
                        </p>
                        {log.ipAddress && (
                          <p className="font-mono text-xs text-muted-foreground">
                            {log.ipAddress}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailTarget(log)}
                          >
                            <Eye className="size-4" aria-hidden />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        {!isPending && (
          <CardFooter className="shrink-0 border-t px-5 py-3">
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>

      <Dialog
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailTarget ? actionVerb(detailTarget.action) : ""}
            </DialogTitle>
            <DialogDescription>
              {detailTarget && (
                <>
                  {detailTarget.action} on {detailTarget.entityType}
                  {detailTarget.entityId ? ` (${detailTarget.entityId.slice(0, 8)})` : ""} ·{" "}
                  {formatDateTime(detailTarget.occurredAt)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Before
                </p>
                {detailTarget?.oldData ? (
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                    {JSON.stringify(detailTarget.oldData, null, 2)}
                  </pre>
                ) : (
                  <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                    No previous data
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  After
                </p>
                {detailTarget?.newData ? (
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                    {JSON.stringify(detailTarget.newData, null, 2)}
                  </pre>
                ) : (
                  <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                    No data
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
