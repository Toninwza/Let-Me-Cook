import type { Metadata } from "next";
import OrderCalendar from "./order-calendar";

export const metadata: Metadata = { title: "Calendar · PULL" };

export default function CalendarPage() {
  return <OrderCalendar />;
}
