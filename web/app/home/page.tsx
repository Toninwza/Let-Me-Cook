import type { Metadata } from "next";
import Home from "./home";

export const metadata: Metadata = { title: "หน้าแรก · PULL" };

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-forest">
      <Home />
    </div>
  );
}
