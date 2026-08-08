"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/api/http";
import {
  type ImportMode,
  type ImportReport,
} from "@/lib/api/field";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  importFile: (file: File, options: { mode?: ImportMode; dryRun?: boolean }) => Promise<ImportReport>;
  getTemplate: () => Promise<{ blob: Blob; fileName: string }>;
  acceptedFormats?: string;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function ImportDialog({
  open,
  onOpenChange,
  title,
  description,
  importFile,
  getTemplate,
  acceptedFormats = ".xlsx,.csv",
}: ImportDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [mode, setMode] = React.useState<ImportMode>("skip");
  const [dryRun, setDryRun] = React.useState(true);
  const [report, setReport] = React.useState<ImportReport | null>(null);

  const mutation = useMutation({
    mutationFn: () => importFile(file as File, { mode, dryRun }),
    onSuccess: (result) => {
      setReport(result);
      toast.success(
        result.dryRun
          ? `Dry run complete: ${result.imported} to import, ${result.updated} to update, ${result.duplicateCount} duplicate, ${result.errorCount} error.`
          : `Import complete: ${result.imported} imported, ${result.updated} updated, ${result.duplicateCount} duplicate, ${result.errorCount} error.`,
      );
      if (!result.dryRun) {
        queryClient.invalidateQueries({ queryKey: ["field"] });
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Import failed."));
    },
  });

  const templateMutation = useMutation({
    mutationFn: getTemplate,
    onSuccess: (result) => saveBlob(result.blob, result.fileName),
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not download the template."));
    },
  });

  function reset() {
    setFile(null);
    setReport(null);
    mutation.reset();
  }

  const duplicatePreview = report?.duplicates.slice(0, 5) ?? [];
  const errorPreview = report?.errors.slice(0, 5) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label>Spreadsheet file</Label>
              <Input
                type="file"
                accept={acceptedFormats}
                onChange={(event) => {
                  setReport(null);
                  mutation.reset();
                  setFile(event.target.files?.[0] ?? null);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => templateMutation.mutate()}
              disabled={templateMutation.isPending}
            >
              {templateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              Template
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="import-mode">On existing name</Label>
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as ImportMode)}
              >
                <SelectTrigger id="import-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm font-medium">
                <Checkbox
                  checked={dryRun}
                  onCheckedChange={(checked) => setDryRun(checked === true)}
                />
                Dry run (validate only)
              </label>
            </div>
          </div>

          {report && (
            <div className="rounded-md border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {report.dryRun ? "Dry run report" : "Import report"}
                  <span className="ml-2 text-muted-foreground">
                    {report.fileName} · {report.totalRows} row
                    {report.totalRows === 1 ? "" : "s"}
                  </span>
                </p>
                {report.errorsCsv && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      saveBlob(
                        new Blob([report.errorsCsv], {
                          type: "text/csv;charset=utf-8;",
                        }),
                        `${report.fileName}.errors.csv`,
                      )
                    }
                  >
                    <Download className="size-4" aria-hidden />
                    Errors CSV
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-md bg-success/10 px-2 py-2">
                  <p className="text-lg font-semibold text-success">
                    {report.imported}
                  </p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="rounded-md bg-muted px-2 py-2">
                  <p className="text-lg font-semibold">{report.updated}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="rounded-md bg-warning/10 px-2 py-2">
                  <p className="text-lg font-semibold text-warning">
                    {report.duplicateCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Duplicate</p>
                </div>
                <div className="rounded-md bg-destructive/10 px-2 py-2">
                  <p className="text-lg font-semibold text-destructive">
                    {report.errorCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              {report.routesCreated ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {report.routesCreated} route
                  {report.routesCreated === 1 ? "" : "s"} created from the
                  route_name column
                </p>
              ) : null}

              {(duplicatePreview.length > 0 || errorPreview.length > 0) && (
                <div className="mt-3 space-y-2 text-sm">
                  {duplicatePreview.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium">Duplicates</p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {duplicatePreview.map((duplicate) => (
                          <li key={`${duplicate.row}-${duplicate.name}`}>
                            Row {duplicate.row}: {duplicate.name} — already
                            exists
                          </li>
                        ))}
                        {report.duplicates.length > duplicatePreview.length && (
                          <li>…and {report.duplicates.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {errorPreview.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium">Errors</p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {errorPreview.map((error) => (
                          <li key={`${error.row}-${error.name}`}>
                            Row {error.row}: {error.errors.join("; ")}
                          </li>
                        ))}
                        {report.errors.length > errorPreview.length && (
                          <li>…and {report.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!file || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileUp className="size-4" aria-hidden />
            )}
            {dryRun ? "Validate" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
