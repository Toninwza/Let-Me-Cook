import { Suspense } from "react";
import ShopOrders from "./shop-orders";

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopOrders />
    </Suspense>
  );
}
