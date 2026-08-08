import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  MapPinned,
  Route as RouteIcon,
  Target,
  UserRound,
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
    href: "/field/outlets",
    title: "Outlets",
    description:
      "Retail stores, wholesalers and HORECA points you sell to, with contact and location details.",
    icon: MapPinned,
  },
  {
    href: "/field/routes",
    title: "Routes",
    description:
      "Named routes that group outlets into efficient visiting schedules.",
    icon: RouteIcon,
  },
  {
    href: "/field/route-assignments",
    title: "Route assignments",
    description:
      "Which salesperson covers which route, and on which weekdays.",
    icon: UserRound,
  },
  {
    href: "/field/visits",
    title: "Field visits",
    description:
      "Planned and unplanned visits to outlets, with check-in and check-out tracking.",
    icon: CalendarClock,
  },
  {
    href: "/field/sales-targets",
    title: "Sales targets",
    description:
      "Monthly sales targets per salesperson — personal, by category or by brand.",
    icon: Target,
  },
];

export default function FieldOverviewPage() {
  return (
    <PageContainer
      icon={MapPinned}
      title="Field"
      description="Outlets, routes, visits and sales targets."
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
                  <CardTitle className="text-base">
                    {resource.title}
                  </CardTitle>
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
