import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { CustomersSection } from "@/components/customers-section";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await getProfile();
  // Admins manage customers from Settings.
  if (profile.role === "admin") redirect("/admin/settings?tab=customers");
  return <CustomersSection isAdmin={false} />;
}
