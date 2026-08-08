"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const swatches = [
  { name: "Primary", className: "bg-primary text-primary-foreground" },
  { name: "Accent", className: "bg-accent text-accent-foreground" },
  { name: "Success", className: "bg-success text-success-foreground" },
  { name: "Warning", className: "bg-warning text-warning-foreground" },
  { name: "Danger", className: "bg-destructive text-destructive-foreground" },
  { name: "Info", className: "bg-info text-info-foreground" },
  { name: "Muted", className: "bg-muted text-muted-foreground" },
  { name: "Card", className: "bg-card text-card-foreground border border-border" },
];

const buttons = [
  { label: "Primary", className: "bg-primary text-primary-foreground hover:bg-primary/90" },
  { label: "Accent", className: "bg-accent text-accent-foreground hover:bg-accent/90" },
  { label: "Outline", className: "border border-border bg-card hover:bg-muted" },
  { label: "Ghost", className: "hover:bg-muted" },
  { label: "Danger", className: "bg-destructive text-destructive-foreground hover:bg-destructive/90" },
];

const badges: { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }[] = [
  { label: "Draft", variant: "secondary" },
  { label: "Active", variant: "default" },
  { label: "Voided", variant: "destructive" },
  { label: "Outlined", variant: "outline" },
];

const typeScale = [
  { label: "Display", cls: "text-5xl font-semibold tracking-tight" },
  { label: "Heading", cls: "text-3xl font-semibold tracking-tight" },
  { label: "Title", cls: "text-xl font-medium" },
  { label: "Body", cls: "text-base" },
  { label: "Body sm", cls: "text-sm text-muted-foreground" },
  { label: "Caption", cls: "text-xs text-muted-foreground" },
];

const money = [
  { item: "Invoice #INV-1042", qty: "36", rate: "1,250.00", amount: "45,000.00" },
  { item: "Invoice #INV-1043", qty: "12", rate: "3,480.75", amount: "41,769.00" },
  { item: "Invoice #INV-1044", qty: "60", rate: "875.50", amount: "52,530.00" },
];

export default function DesignTokensPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              ND
            </span>
            <span className="text-sm font-semibold">NEOS DMS</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-4 py-10">
        <section className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Design tokens</h1>
          <p className="text-sm text-muted-foreground">
            Teal primary · Cobalt accent · Inter · 4px spacing grid · light &amp; dark
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Buttons
          </h2>
          <div className="flex flex-wrap gap-3">
            {buttons.map((b) => (
              <button
                key={b.label}
                className={cn(
                  "h-10 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  b.className,
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Primitives
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus /> New invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>New invoice</DialogTitle>
                  <DialogDescription>
                    Create a new sales invoice for an outlet.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="outlet">Outlet</Label>
                    <Select defaultValue="kathmandu">
                      <SelectTrigger id="outlet" className="w-full">
                        <SelectValue placeholder="Select outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kathmandu">Kathmandu Store</SelectItem>
                        <SelectItem value="patan">Patan Mini Mart</SelectItem>
                        <SelectItem value="bhaktapur">Bhaktapur Traders</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount (NPR)</Label>
                    <Input id="amount" inputMode="decimal" placeholder="0.00" className="tnum" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Select defaultValue="today">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox id="notify" defaultChecked />
              <Label htmlFor="notify">Notify customer</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="auto-post" />
              <Label htmlFor="auto-post">Auto-post journal</Label>
            </div>

            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <Badge key={b.label} variant={b.variant}>
                  {b.label}
                </Badge>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.success("Invoice INV-1042 saved")}
            >
              Show toast
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.error("Failed to sync — check your connection")
              }
            >
              Error toast
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Colors
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map((s) => (
              <div
                key={s.name}
                className={cn(
                  "flex h-20 flex-col justify-end rounded-lg p-3 text-xs font-medium",
                  s.className,
                )}
              >
                {s.name}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Typography
          </h2>
          <div className="space-y-3">
            {typeScale.map((t) => (
              <p key={t.label} className={t.cls}>
                {t.label} — The quick brown fox
              </p>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Tabular numbers (NPR)
          </h2>
          <Card>
            {money.map((row) => (
              <div
                key={row.item}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-6 border-b border-border px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_80px_120px_120px]"
              >
                <span className="truncate">{row.item}</span>
                <span className="tnum text-right text-muted-foreground">{row.qty}</span>
                <span className="tnum text-right text-muted-foreground">{row.rate}</span>
                <span className="tnum text-right font-medium">{row.amount}</span>
              </div>
            ))}
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        NEOS DMS — theme foundation
      </footer>
    </div>
  );
}
