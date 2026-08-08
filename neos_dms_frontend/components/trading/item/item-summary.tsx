"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { accountApi } from "@/lib/api/accounting";
import { type Item } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  GOODS: "Goods",
  SERVICE: "Service",
  RAW: "Raw material",
  ASSET: "Asset",
};

const VALUATION_LABELS: Record<string, string> = {
  FIFO: "FIFO",
  WEIGHTED_AVERAGE: "Weighted average",
};

const TRACKING_LABELS: Record<string, string> = {
  NONE: "None",
  QUANTITY: "Quantity",
  BATCH: "Batch",
  SERIAL: "Serial",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

export function ItemSummary({ item }: { item: Item }) {
  const { data: accountData, isPending: accountsPending } = useQuery({
    queryKey: queryKeys.accounting.accountList({ limit: 100 }),
    queryFn: () => accountApi.list({ limit: 100 }),
  });
  const accounts = accountData?.data ?? [];

  function accountName(accountId: string | null): string {
    if (!accountId) return "Not set";
    const account = accounts.find((candidate) => candidate.id === accountId);
    return account ? `${account.code} · ${account.name}` : "Not set";
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">{item.name}</CardTitle>
          <Badge
            variant={item.isActive ? "default" : "outline"}
            className={cn(
              item.isActive && "bg-success/10 text-success hover:bg-success/10",
            )}
          >
            {item.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="secondary" className="text-muted-foreground">
            {TYPE_LABELS[item.type] ?? item.type}
          </Badge>
        </div>
        <CardDescription>
          {[item.code, item.sku, item.barcode]
            .filter(Boolean)
            .join(" · ") || "Item master"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {item.description && (
          <p className="mb-4 text-sm text-muted-foreground">
            {item.description}
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Category" value={item.category?.name ?? "—"} />
          <Field label="Brand" value={item.brand?.name ?? "—"} />
          <Field
            label="Base unit"
            value={
              item.baseUom
                ? `${item.baseUom.name} (${item.baseUom.shortName})`
                : "—"
            }
          />
          <Field label="HSN code" value={item.hsnCode || "—"} />
          <Field
            label="Tax code"
            value={
              item.taxCode
                ? `${item.taxCode.name} (${Number(item.taxCode.rate)}%)`
                : "Not set"
            }
          />
          <Field
            label="Valuation method"
            value={VALUATION_LABELS[item.valuationMethod] ?? item.valuationMethod}
          />
        </dl>

        <Separator className="my-5" />

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="MRP" value={formatMoney(item.mrp)} />
          <Field label="Sale price" value={formatMoney(item.salePrice)} />
          <Field label="Standard cost" value={formatMoney(item.standardCost)} />
        </dl>

        <Separator className="my-5" />

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Inventory tracking"
            value={TRACKING_LABELS[item.inventoryTracking] ?? item.inventoryTracking}
          />
          <Field label="Reorder level" value={formatNumber(item.reorderLevel)} />
          <Field label="Track expiry" value={item.trackExpiry ? "Yes" : "No"} />
          <Field
            label="Allow negative stock"
            value={item.allowNegativeStock ? "Yes" : "No"}
          />
        </dl>

        <Separator className="my-5" />

        <div>
          <h3 className="mb-3 text-sm font-medium">Posting accounts</h3>
          {accountsPending ? (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Sales" value={accountName(item.salesAccountId)} />
              <Field
                label="Purchase"
                value={accountName(item.purchaseAccountId)}
              />
              <Field
                label="Sales return"
                value={accountName(item.salesReturnAccountId)}
              />
              <Field
                label="Purchase return"
                value={accountName(item.purchaseReturnAccountId)}
              />
            </dl>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
