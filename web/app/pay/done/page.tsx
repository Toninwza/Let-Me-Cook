import type { Metadata } from "next";
import { Suspense } from "react";
import { PayDone } from "./pay-done";

export const metadata: Metadata = { title: "ชำระเงิน · Let-Me-Cook" };

/** Stripe Checkout sends the customer back here (success_url / cancel_url). */
export default function PayDonePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-linear-to-br from-violet-100 via-white to-fuchsia-100 p-4">
      <Suspense>
        <PayDone />
      </Suspense>
    </div>
  );
}
