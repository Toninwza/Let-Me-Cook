import { redirect } from "next/navigation";

/** The old /home is the landing page now. */
export default function HomeRedirect() {
  redirect("/");
}
