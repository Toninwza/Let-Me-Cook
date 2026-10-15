import type { Metadata } from "next";
import { ShopDashboard } from "@/components/shop-dashboard";

export const metadata: Metadata = { title: "หน้าร้านค้า · Let-Me-Cook" };

export default function ShopPage() {
  return <ShopDashboard />;
}
