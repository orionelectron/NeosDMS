"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { itemApi } from "@/lib/api/trading";
import { queryKeys } from "@/lib/query/keys";
import { ItemSummary } from "@/components/trading/item/item-summary";
import { ItemFormSheet } from "@/components/trading/item/item-form";

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const canUpdate = can("trading.item.update");
  const [formOpen, setFormOpen] = React.useState(false);

  const { data: item, isPending, isError } = useQuery({
    queryKey: queryKeys.trading.itemDetail(params.id),
    queryFn: () => itemApi.get(params.id),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/trading/items">
            <ArrowLeft className="size-4" aria-hidden />
            Back to items
          </Link>
        </Button>
        {item && canUpdate && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            Edit item
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !item ? (
        <p className="text-sm text-muted-foreground">
          This item could not be loaded.
        </p>
      ) : (
        <>
          <ItemSummary item={item} />
          <ItemFormSheet
            open={formOpen}
            onOpenChange={setFormOpen}
            item={item}
          />
        </>
      )}
    </div>
  );
}
