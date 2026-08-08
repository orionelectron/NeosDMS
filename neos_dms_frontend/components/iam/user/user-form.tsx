"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/api/http";
import { roleApi, userApi, type User } from "@/lib/api/iam";
import { branchApi } from "@/lib/api/accounting";
import { queryKeys } from "@/lib/query/keys";
import { userFormSchema, type UserFormValues } from "@/lib/validation/iam";

const NO_ROLE = "none";

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

function sectionLabel(children: React.ReactNode) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function UserFormSheet({ open, onOpenChange, user }: UserFormSheetProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(user);
  const [showPassword, setShowPassword] = React.useState(false);

  const { data: roles } = useQuery({
    queryKey: queryKeys.iam.roleList,
    queryFn: () => roleApi.list(),
  });

  const { data: branches } = useQuery({
    queryKey: ["accounting", "branches"],
    queryFn: () => branchApi.list(),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      password: "",
      branchId: "",
      roleId: NO_ROLE,
      mustChangePassword: true,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(
        user
          ? {
              fullName: user.fullName,
              email: user.email,
              username: user.username ?? "",
              password: "",
              branchId: user.branchId,
              roleId: user.roleId ?? NO_ROLE,
              mustChangePassword: user.mustChangePassword,
              isActive: user.isActive,
            }
          : {
              fullName: "",
              email: "",
              username: "",
              password: "",
              branchId: "",
              roleId: NO_ROLE,
              mustChangePassword: true,
              isActive: true,
            },
      );
    }
  }, [open, user, form]);

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (user) {
        return userApi.update(user.id, {
          fullName: values.fullName,
          email: values.email,
          username: values.username.trim() || null,
          branchId: values.branchId,
          roleId: values.roleId === NO_ROLE ? null : values.roleId,
          mustChangePassword: values.mustChangePassword,
          isActive: values.isActive,
        });
      }
      return userApi.create({
        fullName: values.fullName,
        email: values.email,
        username: values.username.trim() || null,
        password: values.password,
        branchId: values.branchId,
        roleId: values.roleId === NO_ROLE ? undefined : values.roleId,
        mustChangePassword: values.mustChangePassword,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "User updated." : "User created.");
      queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not save the user."));
    },
  });

  function onSubmit(values: UserFormValues) {
    if (!editing && values.password.length < 8) {
      form.setError("password", {
        type: "manual",
        message: "Password must be at least 8 characters.",
      });
      return;
    }
    mutation.mutate(values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit user" : "New user"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Update the member's profile, branch and access."
              : "Add a team member. They can sign in immediately with the password you set."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 px-4"
          >
            <div className="space-y-3">
              {sectionLabel("Profile")}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Bimal Shrestha" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="e.g. bimal@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional — e.g. bimals" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              {sectionLabel("Access")}
              <FormField
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches?.map((branch) => (
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
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_ROLE}>No role</SelectItem>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!editing && (
              <div className="space-y-3">
                {sectionLabel("Password")}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="At least 8 characters"
                            className="pr-10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((value) => !value)}
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" aria-hidden />
                            ) : (
                              <Eye className="size-4" aria-hidden />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mustChangePassword"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                      <div>
                        <FormLabel className="mb-0 text-sm">
                          Change password on first sign-in
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          The member must set their own password after logging
                          in.
                        </p>
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
              </div>
            )}

            {editing && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <FormLabel className="mb-0 text-sm">Active</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Inactive members cannot sign in.
                      </p>
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
            )}

            <div className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="ml-auto"
                >
                  {mutation.isPending && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  {editing ? "Save changes" : "Create user"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
