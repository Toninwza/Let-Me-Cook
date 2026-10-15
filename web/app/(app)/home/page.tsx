import type { Metadata } from "next";
import Home from "./home";

export const metadata: Metadata = { title: "หน้าแรก · PULL" };

export default function HomePage() {
  return (
    <div className="h-full overflow-y-auto bg-forest">
      <Home />
    </div>
  );
}
