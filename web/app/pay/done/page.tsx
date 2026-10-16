import type { Metadata } from "next";
import { Suspense } from "react";
import { PayDone } from "./pay-done";

export const metadata: Metadata = { title: "Payment · PULL" };

/** Stripe Checkout sends the customer back here (success_url / cancel_url). */
export default function PayDonePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground p-4">
      <Suspense fallback={null}>
        <PayDone />
      </Suspense>
    </div>
  );
}
