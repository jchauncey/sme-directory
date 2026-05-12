import { redirect } from "next/navigation";

export default function ApplicationsRedirect(): never {
  redirect("/me/groups");
}
