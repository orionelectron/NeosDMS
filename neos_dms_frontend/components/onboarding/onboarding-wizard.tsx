"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { PlanSelect } from "@/components/onboarding/plan-select";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/api/http";
import { type RegisterDto } from "@/lib/api/auth";
import { plansApi } from "@/lib/api/plans";
import { queryKeys } from "@/lib/query/keys";
import {
  BILLING_PERIODS,
  DEFAULT_PERIOD,
  DEFAULT_PLANS,
  type BillingPeriod,
} from "@/lib/plans";

const onboardingSchema = z
  .object({
    name: z.string().trim().min(2, "Organization name is required"),
    legalName: z.string().trim().optional().or(z.literal("")),
    orgEmail: z
      .string()
      .trim()
      .min(1, "Organization email is required")
      .email("Enter a valid email address"),
    phoneNumber: z.string().trim().min(7, "Phone number is required"),
    panNumber: z.string().trim().min(1, "PAN number is required"),
    vatNumber: z.string().trim().optional().or(z.literal("")),
    address: z.string().trim().optional().or(z.literal("")),
    branchName: z.string().trim().optional().or(z.literal("")),
    fullName: z.string().trim().min(2, "Your full name is required"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    planCode: z.string().min(1, "Choose a plan"),
    periodName: z.enum(BILLING_PERIODS),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type OnboardingValues = z.infer<typeof onboardingSchema>;

const steps = [
  {
    title: "Organization",
    fields: [
      "name",
      "legalName",
      "orgEmail",
      "phoneNumber",
      "panNumber",
      "vatNumber",
      "address",
      "branchName",
    ],
  },
  {
    title: "Owner account",
    fields: ["fullName", "email", "password", "confirmPassword"],
  },
  {
    title: "Plan",
    fields: ["planCode", "periodName"],
  },
] as const;

function buildRegisterDto(values: OnboardingValues): RegisterDto {
  const optional = (value: string | undefined) =>
    value?.trim() ? value.trim() : undefined;
  return {
    name: values.name,
    legalName: optional(values.legalName),
    email: values.orgEmail,
    phoneNumber: values.phoneNumber,
    panNumber: values.panNumber,
    vatNumber: optional(values.vatNumber),
    address: optional(values.address),
    branchName: optional(values.branchName),
    planCode: values.planCode,
    periodName: values.periodName,
    owner: {
      fullName: values.fullName,
      email: values.email,
      password: values.password,
    },
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, register } = useAuth();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  const { data: plans = DEFAULT_PLANS } = useQuery({
    queryKey: queryKeys.plans.all,
    queryFn: plansApi.list,
    placeholderData: DEFAULT_PLANS,
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      legalName: "",
      orgEmail: "",
      phoneNumber: "",
      panNumber: "",
      vatNumber: "",
      address: "",
      branchName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      planCode: searchParams.get("plan") ?? "starter",
      periodName:
        (searchParams.get("period") as BillingPeriod | null) ?? DEFAULT_PERIOD,
    },
  });

  const planCode = useWatch({ control: form.control, name: "planCode" });
  const periodName = useWatch({ control: form.control, name: "periodName" });

  React.useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function handleNext() {
    const valid = await form.trigger(steps[step].fields);
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleSubmit(values: OnboardingValues) {
    setSubmitting(true);
    try {
      await register(buildRegisterDto(values));
      toast.success("Workspace created — welcome to NEOS DMS");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up your organization, your account and your plan — all in one
          step.
        </p>
      </div>

      <StepIndicator
        steps={steps.map((s) => s.title)}
        current={step}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{steps[step].title}</CardTitle>
          <CardDescription>
            {step === 0 &&
              "Your company details appear on invoices and the CBMS push."}
            {step === 1 &&
              "This account becomes the organization owner with full access."}
            {step === 2 &&
              "Pick a plan — every plan starts with a 3-day grace period."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
              noValidate
            >
              {step === 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Kathmandu Trading Co."
                            autoComplete="organization"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal name (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="As registered with IRD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="orgEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="billing@company.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="98XXXXXXXX"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN number</FormLabel>
                        <FormControl>
                          <Input placeholder="6XXXXXXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vatNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VAT number (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Registration no." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Kathmandu, Nepal"
                            autoComplete="street-address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="branchName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Head office branch (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Default branch" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Asmita Sharma"
                            autoComplete="name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Work email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="username"
                            placeholder="asmita@company.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Minimum 8 characters"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Repeat password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {step === 2 && (
                <PlanSelect
                  plans={plans}
                  value={planCode}
                  onChange={(planCode) => form.setValue("planCode", planCode)}
                  period={periodName}
                  onPeriodChange={(periodName) =>
                    form.setValue("periodName", periodName)
                  }
                />
              )}

              <div className="flex items-center justify-between pt-2">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep((current) => current - 1)}
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                ) : (
                  <Button asChild variant="ghost">
                    <Link href="/login">Have an account?</Link>
                  </Button>
                )}
                {step < steps.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    Continue <ArrowRight className="size-4" aria-hidden />
                  </Button>
                ) : (
                  <Button type="submit" disabled={submitting}>
                    {submitting && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    {submitting ? "Creating…" : "Create workspace"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
