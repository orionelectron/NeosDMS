"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/app-shell/page-container";
import { LayoutGrid } from "lucide-react";

const kpis = [
  {
    title: "Active organizations",
    value: "—",
    note: "Tenant management in Organizations",
  },
  {
    title: "Active subscriptions",
    value: "—",
    note: "Billing in Subscriptions",
  },
  {
    title: "Platform users",
    value: "—",
    note: "Admins in Platform users",
  },
];

export default function PlatformDashboardPage() {
  return (
    <PageContainer
      icon={LayoutGrid}
      title="Platform"
      description="Monitor organizations, subscriptions and platform administrators."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight tnum">
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
