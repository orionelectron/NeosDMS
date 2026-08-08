import Link from "next/link";
import { ArrowRight, ScrollText, Users } from "lucide-react";
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
    href: "/iam/users",
    title: "Users",
    description: "Team members, their branches, roles and sign-in access.",
    icon: Users,
  },
  {
    href: "/iam/audit-logs",
    title: "Audit log",
    description: "A record of who changed what across the system, and when.",
    icon: ScrollText,
  },
];

export default function AccessOverviewPage() {
  return (
    <PageContainer
      icon={Users}
      title="Access"
      description="Manage who can sign in and what they can do."
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
