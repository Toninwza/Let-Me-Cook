import type { Metadata } from "next";
import { Suspense } from "react";
import Chat from "./chat";

export const metadata: Metadata = { title: "แชท · PULL" };

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}
