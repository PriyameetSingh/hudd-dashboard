import { redirect } from "next/navigation";

/** Legacy URL — canonical route is `/dashboard`. */
export default function CommandCentreRedirectPage() {
  redirect("/dashboard");
}
