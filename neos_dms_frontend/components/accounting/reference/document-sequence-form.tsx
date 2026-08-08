"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
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
import { getErrorMessage } from "@/lib/api/http";
import {
  branchApi,
  documentSequenceApi,
  DOCUMENT_TYPES,
  fiscalYearApi,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";

const NO_BRANCH = "none";
const NO_FISCAL_YEAR = "none";

const sequenceSchema = z.object({
  documentType: z.string().min(1, "Select a document type"),
  branchId: z.string(),
  fiscalYearId: z.string(),
  prefix: z
    .string()
    .trim()
    .max(10, "Prefix must be 10 characters or fewer"),
  lastNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{0,10}$/, "Enter a whole number"),
});

type SequenceValues = z.infer<typeof sequenceSchema>;

interface DocumentSequenceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentSequenceFormSheet({
  open,
  onOpenChange,
}: DocumentSequenceFormSheetProps) {
  const queryClient = useQueryClient();

  const { data: branchData } = useQuery({
    queryKey: ["accounting", "branches"],
    queryFn: () => branchApi.list(),
  });

  const { data: fiscalYearData } = useQuery({
    queryKey: queryKeys.accounting.fiscalYearList,
    queryFn: () => fiscalYearApi.list(),
  });

  const form = useForm<SequenceValues>({
    resolver: zodResolver(sequenceSchema),
    defaultValues: {
      documentType: "",
      branchId: NO_BRANCH,
      fiscalYearId: NO_FISCAL_YEAR,
      prefix: "",
      lastNumber: "0",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        documentType: "",
        branchId: NO_BRANCH,
        fiscalYearId: NO_FISCAL_YEAR,
        prefix: "",
        lastNumber: "0",
      });
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: SequenceValues) =>
      documentSequenceApi.create({
        documentType: values.documentType as (typeof DOCUMENT_TYPES)[number],
        branchId:
          values.branchId === NO_BRANCH ? undefined : values.branchId,
        fiscalYearId:
          values.fiscalYearId === NO_FISCAL_YEAR
            ? undefined
            : values.fiscalYearId,
        prefix: values.prefix === "" ? undefined : values.prefix,
        lastNumber:
          values.lastNumber === "" ? undefined : Number(values.lastNumber),
      }),
    onSuccess: () => {
      toast.success("Document sequence created.");
      queryClient.invalidateQueries({
        queryKey: ["accounting", "document-sequences"],
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not create the sequence."));
    },
  });

  function onSubmit(values: SequenceValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New document sequence</SheetTitle>
          <SheetDescription>
            A sequence reserves numbers per document type when entries are
            posted.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type
                            .split("_")
                            .map(
                              (part) =>
                                part.charAt(0).toUpperCase() + part.slice(1),
                            )
                            .join(" ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_BRANCH}>Global</SelectItem>
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
                name="fiscalYearId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiscal year</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={(fiscalYearData ?? []).length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_FISCAL_YEAR}>Global</SelectItem>
                        {(fiscalYearData ?? []).map((fiscalYear) => (
                          <SelectItem
                            key={fiscalYear.id}
                            value={fiscalYear.id}
                          >
                            {fiscalYear.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prefix</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. JE-" {...field} />
                    </FormControl>
                    <FormDescription>Prepended to the number.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting number</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      The next number is one greater.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SheetFooter className="pt-2">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Create sequence
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
