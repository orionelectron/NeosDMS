import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  Users,
  ScrollText,
  Scale,
  Percent,
  Hash,
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
    href: "/accounting/accounts",
    title: "Chart of accounts",
    description:
      "The accounts the ledger posts to — assets, liabilities, equity, income and expense.",
    icon: BookOpen,
  },
  {
    href: "/accounting/fiscal-years",
    title: "Fiscal years",
    description:
      "BS fiscal years with their twelve periods; open and close posting windows.",
    icon: CalendarRange,
  },
  {
    href: "/accounting/parties",
    title: "Parties",
    description:
      "Customers, suppliers and leads with contact details and credit terms.",
    icon: Users,
  },
  {
    href: "/accounting/journal-entries",
    title: "Journal entries",
    description:
      "Draft, post and cancel balanced journal entries posted to the ledger.",
    icon: ScrollText,
  },
  {
    href: "/accounting/trial-balance",
    title: "Trial balance",
    description:
      "Opening, activity and closing balances per account within a fiscal year.",
    icon: Scale,
  },
  {
    href: "/accounting/tax",
    title: "Tax codes",
    description:
      "System tax types, templates and the organization's VAT/TDS tax codes.",
    icon: Percent,
  },
  {
    href: "/accounting/document-sequences",
    title: "Document sequences",
    description:
      "Running numbering for invoices, journals and other documents.",
    icon: Hash,
  },
];

export default function AccountingOverviewPage() {
  return (
    <PageContainer
      icon={BookOpen}
      title="Accounting"
      description="Chart of accounts, journals, parties and taxes."
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
