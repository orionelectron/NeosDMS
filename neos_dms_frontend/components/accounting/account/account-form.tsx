"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/api/http";
import {
  accountApi,
  COA_TYPES,
  type Account,
} from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { accountSchema, type AccountValues } from "@/lib/validation/accounting";

const NO_PARENT = "none";

interface AccountFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
}

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
}: AccountFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(account);

  const { data: parentData } = useQuery({
    queryKey: queryKeys.accounting.accountList({ limit: 100 }),
    queryFn: () => accountApi.list({ limit: 100 }),
  });

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      code: "",
      coaType: "ASSET",
      parentAccountId: NO_PARENT,
      isGroup: false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        account
          ? {
              name: account.name,
              code: account.code,
              coaType: account.coaType,
              parentAccountId: account.parentAccountId ?? NO_PARENT,
              isGroup: account.isGroup,
            }
          : {
              name: "",
              code: "",
              coaType: "ASSET",
              parentAccountId: NO_PARENT,
              isGroup: false,
            },
      );
    }
  }, [open, account, form]);

  const parentOptions = (parentData?.data ?? []).filter((option) => {
    if (!option.isGroup) return false;
    if (option.id === account?.id) return false;
    if (account?.path && account.path.length > 0) {
      const prefix = `${account.path}/`;
      if (option.path === account.path || option.path?.startsWith(prefix)) {
        return false;
      }
    }
    return true;
  });

  const mutation = useMutation({
    mutationFn: (values: AccountValues) => {
      const parentAccountId =
        values.parentAccountId === NO_PARENT ? null : values.parentAccountId;
      if (account) {
        return accountApi.update(account.id, {
          name: values.name,
          parentAccountId,
          isGroup: values.isGroup,
        });
      }
      return accountApi.create({
        name: values.name,
        code: values.code,
        coaType: values.coaType,
        parentAccountId,
        isGroup: values.isGroup,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Account updated." : "Account created.");
      queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the account."));
    },
  });

  function onSubmit(values: AccountValues) {
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit account" : "New account"}</SheetTitle>
          <SheetDescription>
            Accounts live in the chart of accounts. System accounts are
            managed by the app and cannot be edited.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Cash in Hand" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 1001"
                      {...field}
                      disabled={editing}
                    />
                  </FormControl>
                  <FormDescription>
                    {editing
                      ? "The code cannot be changed after creation."
                      : "Unique per organization."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coaType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={editing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COA_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {editing
                      ? "The type cannot be changed after creation."
                      : "Asset, liability, equity, income or expense."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent account</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={parentOptions.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No parent account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>None</SelectItem>
                      {parentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.code} — {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Only group accounts can be parents.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isGroup"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <FormLabel>Group account</FormLabel>
                    <FormDescription>
                      Group accounts hold children and cannot be posted to.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
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
                {editing ? "Save changes" : "Create account"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
