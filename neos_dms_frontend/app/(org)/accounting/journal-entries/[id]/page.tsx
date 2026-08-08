"use client";

import { useParams } from "next/navigation";
import { JournalDetail } from "@/components/accounting/journal/journal-detail";

export default function JournalEntryDetailPage() {
  const params = useParams<{ id: string }>();
  return <JournalDetail id={params.id} />;
}
