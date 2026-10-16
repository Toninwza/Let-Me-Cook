import type { Metadata } from "next";
import { Suspense } from "react";
import Chat from "./chat";

export const metadata: Metadata = { title: "Chat · PULL" };

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}
