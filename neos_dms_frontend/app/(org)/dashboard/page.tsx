"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/app-shell/page-container";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

const kpis = [
  {
    title: "Today's sales",
    value: "—",
    note: "Goes live with the Sales module",
  },
  {
    title: "Collections",
    value: "—",
    note: "Receipts tracked in Sales",
  },
  {
    title: "Low stock",
    value: "—",
    note: "Alerts from Inventory",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(/\s+/)[0];

  return (
    <PageContainer
      icon={LayoutDashboard}
      title="Dashboard"
      description={`Welcome back${firstName ? `, ${firstName}` : ""}.`}
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
