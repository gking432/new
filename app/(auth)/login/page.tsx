import { redirect } from "next/navigation";

// This is a no-login portfolio demo. Any old links to /login (the public
// header, the case study) drop straight into the dashboard + tutorial.
export default function LoginPage() {
  redirect("/app?tour=welcome");
}
