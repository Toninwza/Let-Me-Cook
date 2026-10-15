import type { Metadata } from "next";
import Login from "./login";

export const metadata: Metadata = { title: "เข้าสู่ระบบ · PULL" };

export default function LoginPage() {
  return <Login />;
}
