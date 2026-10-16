import AppShell from "@/components/app-shell";
import { CartProvider } from "@/lib/cart";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AppShell>{children}</AppShell>
    </CartProvider>
  );
}
