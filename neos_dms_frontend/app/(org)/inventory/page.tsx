import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Boxes,
  MapPin,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell/page-container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RESOURCES = [
  {
    href: "/inventory/locations",
    title: "Locations",
    description:
      "Godowns, shops, vans and warehouses that hold stock, with a default store.",
    icon: MapPin,
  },
  {
    href: "/inventory/balances",
    title: "Stock balances",
    description:
      "On-hand quantity and moving-average cost per item at each location.",
    icon: Boxes,
  },
  {
    href: "/inventory/transactions",
    title: "Movements",
    description:
      "Opening stock, adjustments and transfers — the stock activity ledger.",
    icon: ArrowUpDown,
  },
  {
    href: "/inventory/low-stock",
    title: "Low stock",
    description:
      "Items at or below their reorder level so you can restock before running out.",
    icon: AlertTriangle,
  },
];

export default function InventoryOverviewPage() {
  return (
    <PageContainer
      icon={Boxes}
      title="Inventory"
      description="Stock balances, locations and adjustments."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <Link key={resource.href} href={resource.href} className="group">
              <Card className="h-full transition-colors group-hover:border-ring/50 group-hover:bg-muted/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <ArrowRight
                      className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </div>
                  <CardTitle className="text-base">{resource.title}</CardTitle>
                  <CardDescription className="text-pretty">
                    {resource.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-sm font-medium text-accent">
                    Manage →
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
