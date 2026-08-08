import Link from "next/link";
import {
  Boxes,
  Package,
  Tags,
  Scale,
  ArrowRight,
  SlidersHorizontal,
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
    href: "/trading/items",
    title: "Items",
    description:
      "Products and SKUs — pricing, tax codes, valuation and inventory settings.",
    icon: Package,
  },
  {
    href: "/trading/categories",
    title: "Categories",
    description: "Group items into a hierarchy for reporting and pricing.",
    icon: Boxes,
  },
  {
    href: "/trading/brands",
    title: "Brands",
    description: "Brands you distribute, assigned to items as needed.",
    icon: Tags,
  },
  {
    href: "/trading/uoms",
    title: "Units of measure",
    description: "Units like case, box and piece used across the system.",
    icon: Scale,
  },
  {
    href: "/trading/conversions",
    title: "UOM conversions",
    description: "Convert between units globally or per item (case ↔ piece).",
    icon: SlidersHorizontal,
  },
];

export default function TradingOverviewPage() {
  return (
    <PageContainer
      icon={Package}
      title="Trading"
      description="Products, brands, categories and units of measure."
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
