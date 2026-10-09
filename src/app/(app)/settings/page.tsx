import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { getWorkflowSettings } from "@/lib/settings";
import { WorkflowSettingsForm } from "@/components/settings/WorkflowSettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getWorkflowSettings(session.tenantId);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Settings</h1>
      <WorkflowSettingsForm settings={settings} canEdit={session.role === "admin"} />
    </div>
  );
}
