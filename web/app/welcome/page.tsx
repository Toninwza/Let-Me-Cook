import type { Metadata } from "next";
import Welcome from "./welcome";

export const metadata: Metadata = { title: "ยินดีต้อนรับ · PULL" };

export default function WelcomePage() {
  return <Welcome />;
}
