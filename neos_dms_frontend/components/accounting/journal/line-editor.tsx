"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, Party } from "@/lib/api/accounting";
import type { JournalValues } from "@/lib/validation/accounting";

interface JournalLineEditorProps {
  index: number;
  accounts: Account[];
  parties: Party[];
  onRemove: () => void;
  error?: string;
}

export function JournalLineEditor({
  index,
  accounts,
  parties,
  onRemove,
  error,
}: JournalLineEditorProps) {
  const { setValue } = useFormContext<JournalValues>();

  // A line may only carry one side. Typing into one field clears the other,
  // so the single-sided rule is enforced while typing instead of at submit.
  function handleDebitChange(value: string) {
    setValue(`lines.${index}.debit`, value);
    if (value !== "") setValue(`lines.${index}.credit`, "");
  }

  function handleCreditChange(value: string) {
    setValue(`lines.${index}.credit`, value);
    if (value !== "") setValue(`lines.${index}.debit`, "");
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Line {index + 1}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Remove line"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>

      {error && (
        <p className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      <FormField
        name={`lines.${index}.accountId`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leaf account" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} — {account.name} ({account.coaType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-2">
        <FormField
          name={`lines.${index}.debit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Debit</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  {...field}
                  onChange={(event) =>
                    handleDebitChange(event.target.value)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name={`lines.${index}.credit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credit</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  {...field}
                  onChange={(event) =>
                    handleCreditChange(event.target.value)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FormField
          name={`lines.${index}.partyId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Party</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">None</SelectItem>
                    {parties.map((party) => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name={`lines.${index}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Input placeholder="e.g. rent for July" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
