"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type NotificationKind = "info" | "success" | "warning" | "danger";

interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  kind: NotificationKind;
  read: boolean;
  href?: string;
}

const KIND_META: Record<
  NotificationKind,
  { icon: typeof Info; className: string }
> = {
  info: { icon: Info, className: "bg-accent/10 text-accent" },
  success: { icon: CheckCircle2, className: "bg-success/10 text-success" },
  warning: { icon: AlertTriangle, className: "bg-warning/10 text-warning" },
  danger: { icon: XCircle, className: "bg-destructive/10 text-destructive" },
};

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    title: "Low stock: Coca-Cola 1.5L",
    description: "12 units left across all locations — reorder soon.",
    time: "8m ago",
    kind: "warning",
    read: false,
    href: "/inventory",
  },
  {
    id: "n2",
    title: "Invoice INV-1042 pushed to CBMS",
    description: "IRP accepted by the tax system for verification.",
    time: "24m ago",
    kind: "success",
    read: false,
    href: "/sales/invoices",
  },
  {
    id: "n3",
    title: "Dispatch DSP-2101 failed at stop 2",
    description: "Outlet closed — mark for re-delivery or return.",
    time: "1h ago",
    kind: "danger",
    read: false,
    href: "/dispatch",
  },
  {
    id: "n4",
    title: "3 new sales orders",
    description: "Route 3 collected orders for tomorrow's loading.",
    time: "2h ago",
    kind: "info",
    read: true,
    href: "/sales/orders",
  },
  {
    id: "n5",
    title: "Payment received from Kirana Mart",
    description: "Rs 84,300 allocated across 2 open invoices.",
    time: "Yesterday",
    kind: "success",
    read: true,
    href: "/accounting",
  },
];

export function Notifications() {
  const [items, setItems] = React.useState<AppNotification[]>(
    INITIAL_NOTIFICATIONS,
  );
  const unreadCount = items.filter((item) => !item.read).length;

  const markRead = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    );
  };

  const clearAll = () => setItems([]);

  const renderList = (list: AppNotification[]) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="text-sm font-medium">You&apos;re all caught up</p>
          <p className="text-xs text-muted-foreground">
            New alerts will show up here.
          </p>
        </div>
      );
    }
    return (
      <ScrollArea className="h-full">
        <ul className="divide-y divide-border">
          {list.map((item) => {
            const { icon: Icon, className } = KIND_META[item.kind];
            const content = (
              <span className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    className,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.title}
                    </span>
                    {!item.read && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">
                    {item.time}
                  </span>
                </span>
              </span>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (
                        e.defaultPrevented ||
                        e.button !== 0 ||
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey
                      ) {
                        return;
                      }
                      e.preventDefault();
                      window.open(item.href, "_blank", "noopener,noreferrer");
                      markRead(item.id);
                    }}
                    className={cn(
                      "block transition-colors hover:bg-muted/60",
                      !item.read && "bg-muted/30",
                    )}
                  >
                    {content}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    className={cn(
                      "block w-full transition-colors hover:bg-muted/60",
                      !item.read && "bg-muted/30",
                    )}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="size-5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex w-[min(22rem,calc(100vw-2rem))] max-h-[min(28rem,calc(100dvh-6rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearAll}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear all
            </Button>
          )}
        </div>
        <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="shrink-0 border-b border-border px-4 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">
                Unread
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="mt-0 min-h-0 flex-1 overflow-hidden">
            {renderList(items)}
          </TabsContent>
          <TabsContent
            value="unread"
            className="mt-0 min-h-0 flex-1 overflow-hidden"
          >
            {renderList(items.filter((item) => !item.read))}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
