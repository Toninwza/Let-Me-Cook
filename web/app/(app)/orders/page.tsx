import type { Metadata } from "next";
import MyOrders from "./my-orders";

export const metadata: Metadata = { title: "ออเดอร์ของฉัน · PULL" };

export default function OrdersPage() {
  return <MyOrders />;
}
