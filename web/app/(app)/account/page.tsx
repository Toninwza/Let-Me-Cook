import type { Metadata } from "next";
import Account from "./account";

export const metadata: Metadata = { title: "My info · PULL" };

export default function AccountPage() {
  return <Account />;
}
