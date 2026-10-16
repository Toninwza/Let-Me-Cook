import type { Metadata } from "next";
import Settings from "./settings";

export const metadata: Metadata = { title: "Settings · PULL" };

export default function SettingsPage() {
  return <Settings />;
}
