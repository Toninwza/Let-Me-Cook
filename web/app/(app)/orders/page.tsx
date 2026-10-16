import type { Metadata } from "next";
import MyOrders from "./my-orders";

export const metadata: Metadata = { title: "Orders · PULL" };

export default function OrdersPage() {
  return <MyOrders />;
}
