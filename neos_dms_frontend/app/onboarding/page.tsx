import { Suspense } from "react";
import { FullScreenLoader } from "@/components/auth/full-screen-loader";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <OnboardingWizard />
    </Suspense>
  );
}
