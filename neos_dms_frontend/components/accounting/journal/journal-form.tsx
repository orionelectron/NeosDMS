"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/api/http";
import {
  accountApi,
  branchApi,
  journalApi,
  partyApi,
  type Account,
  type Party,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { journalSchema, type JournalValues } from "@/lib/validation/accounting";
import { JournalLineEditor } from "@/components/accounting/journal/line-editor";
import { cn } from "@/lib/utils";

function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function emptyLine() {
  return {
    accountId: "",
    partyId: "none",
    description: "",
    debit: "",
    credit: "",
  };
}

interface JournalFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalFormSheet({
  open,
  onOpenChange,
}: JournalFormSheetProps) {
  const queryClient = useQueryClient();

  const { data: branchData } = useQuery({
    queryKey: ["accounting", "branches"],
    queryFn: () => branchApi.list(),
  });

  const { data: accountData } = useQuery({
    queryKey: queryKeys.accounting.accountList({ page: 1, limit: 100 }),
    queryFn: () => accountApi.list({ page: 1, limit: 100 }),
  });

  const { data: partyData } = useQuery({
    queryKey: queryKeys.accounting.partyList({ page: 1, limit: 100 }),
    queryFn: () => partyApi.list({ page: 1, limit: 100 }),
  });

  const accounts = React.useMemo(
    () =>
      (accountData?.data ?? []).filter(
        (account: Account) => !account.isGroup && account.isActive,
      ),
    [accountData],
  );

  const parties = React.useMemo(
    () => (partyData?.data ?? []).filter((party: Party) => party.isActive),
    [partyData],
  );

  const form = useForm<JournalValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      branchId: "",
      entryDate: todayString(),
      description: "",
      lines: [emptyLine(), emptyLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = useWatch({ control: form.control, name: "lines" });

  const totals = React.useMemo(() => {
    const debit = (watchedLines ?? []).reduce(
      (sum, line) => sum + (Number(line.debit) || 0),
      0,
    );
    const credit = (watchedLines ?? []).reduce(
      (sum, line) => sum + (Number(line.credit) || 0),
      0,
    );
    return { debit, credit };
  }, [watchedLines]);

  const balanced =
    totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.0001;

  const difference = totals.debit - totals.credit;
  const needsCredit = difference > 0;
  const canAutoBalance =
    (totals.debit > 0 || totals.credit > 0) && !balanced;

  React.useEffect(() => {
    if (open) {
      form.reset({
        branchId: "",
        entryDate: todayString(),
        description: "",
        lines: [emptyLine(), emptyLine()],
      });
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: JournalValues) =>
      journalApi.create({
        branchId: values.branchId,
        entryDate: values.entryDate,
        description: values.description === "" ? undefined : values.description,
        lines: values.lines.map((line) => ({
          accountId: line.accountId,
          partyId:
            line.partyId === "" || line.partyId === "none"
              ? undefined
              : line.partyId,
          debit: line.debit === "" ? undefined : Number(line.debit),
          credit: line.credit === "" ? undefined : Number(line.credit),
          description:
            line.description === "" ? undefined : line.description,
        })),
      }),
    onSuccess: () => {
      toast.success("Journal entry created as draft.");
      queryClient.invalidateQueries({
        queryKey: ["accounting", "journal-entries"],
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not create the journal entry."));
    },
  });

  function addLine() {
    append(emptyLine());
  }

  function addBalancingLine() {
    append({
      ...emptyLine(),
      debit: needsCredit ? "" : Math.abs(difference).toFixed(2),
      credit: needsCredit ? Math.abs(difference).toFixed(2) : "",
    });
  }

  function onSubmit(values: JournalValues) {
    mutation.mutate(values);
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New journal entry</SheetTitle>
          <SheetDescription>
            Every line posts to a leaf account with a single debit or credit.
            The entry must balance to be saved as a draft.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={(branchData ?? []).length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(branchData ?? []).map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. July office rent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Lines{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({fields.length})
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                >
                  <Plus className="size-4" aria-hidden />
                  Add line
                </Button>
              </div>
              {fields.map((field, index) => (
                <JournalLineEditor
                  key={field.id}
                  index={index}
                  accounts={accounts}
                  parties={parties}
                  onRemove={() => remove(index)}
                  error={errors.lines?.[index]?.root?.message}
                />
              ))}
            </div>

            <div className="sticky bottom-0 -mx-4 space-y-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Scale
                    className={cn(
                      "size-4",
                      balanced ? "text-success" : "text-destructive",
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "font-medium",
                      balanced ? "text-success" : "text-destructive",
                    )}
                  >
                    {balanced
                      ? "Balanced"
                      : totals.debit === 0 && totals.credit === 0
                        ? "Enter debit and credit amounts"
                        : `Needs ${needsCredit ? "credit" : "debit"} of ${Math.abs(difference).toFixed(2)}`}
                  </span>
                </div>
                <div className="tabular-nums text-muted-foreground">
                  Dr {totals.debit.toFixed(2)} · Cr {totals.credit.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canAutoBalance && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBalancingLine}
                  >
                    <Plus className="size-4" aria-hidden />
                    Balance entry (+{Math.abs(difference).toFixed(2)})
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!balanced || mutation.isPending}
                    title={
                      balanced
                        ? undefined
                        : "Add the missing amount to balance the entry"
                    }
                  >
                    {mutation.isPending && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    Create draft
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
