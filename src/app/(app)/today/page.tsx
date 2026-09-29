import { redirect } from "next/navigation";

/** Today was replaced by the Pipeline board; keep old bookmarks working. */
export default function TodayPage() {
  redirect("/pipeline");
}
