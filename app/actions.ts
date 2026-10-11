"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { normalizeTag } from "@/lib/utils";
import type { Result, ScanInfo } from "@/lib/types";

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?error=" + encodeURIComponent("Wrong email or password."));
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type CustomerInput = { id?: string; name: string; phone?: string; address?: string; remarks?: string };

// Staff can add and rename customers (name only). Phone, address and remarks are admin-only,
// and the database enforces it: the customer_details table has no staff access.
export async function saveCustomer(input: CustomerInput): Promise<Result<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return fail("Enter the customer's name.");
  const profile = await getProfile();
  const supabase = await createClient();

  // Staff can add customers; only admins can change existing ones.
  if (input.id && profile.role !== "admin") return fail("Only an admin can edit customers.");
  let id = input.id;
  if (id) {
    const { error } = await supabase.from("customers").update({ name }).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase.from("customers").insert({ name }).select("id").single();
    if (error) return fail(error.message);
    id = data.id as string;
  }

  if (profile.role === "admin") {
    const { error } = await supabase.from("customer_details").upsert({
      customer_id: id,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      remarks: input.remarks?.trim() || null,
    });
    if (error) return fail(error.message);
  }
  revalidateTag("customers");
  revalidatePath("/");
  revalidatePath("/customers");
  return { ok: true, data: { id } };
}

export async function createCustomer(input: { name: string; phone?: string; address?: string }): Promise<Result<{ id: string }>> {
  return saveCustomer(input);
}

export async function deleteCustomer(id: string): Promise<Result> {
  if ((await getProfile()).role !== "admin") return fail("Only an admin can delete customers.");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return fail(error.message);
  revalidateTag("customers");
  revalidatePath("/");
  revalidatePath("/customers");
  return { ok: true, data: null };
}

export async function updateOrder(input: {
  orderId: string;
  customerId: string | null;
  items: { code: string; qty: number }[];
  paid: boolean;
}): Promise<Result> {
  const items = input.items.filter((i) => i.qty > 0);
  if (!items.length) return fail("Add at least one gallon.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order", {
    p_order_id: input.orderId,
    p_customer_id: input.customerId,
    p_items: items,
    p_paid: input.paid,
  });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function createOrder(input: {
  customerId: string | null;
  items: { code: string; qty: number }[];
  paid: boolean;
}): Promise<Result<{ id: string; tag: string; orderNumber: number }>> {
  const items = input.items.filter((i) => i.qty > 0);
  if (!items.length) return fail("Add at least one gallon.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_customer_id: input.customerId,
    p_items: items,
    p_paid: input.paid,
  });
  if (error) return fail(error.message);
  revalidatePath("/");
  const id = data as string;
  const { data: row } = await supabase.from("orders").select("order_number, qr_tag_id").eq("id", id).single();
  return { ok: true, data: { id, tag: row?.qr_tag_id ?? "", orderNumber: row?.order_number ?? 0 } };
}

export async function scanTag(rawTag: string): Promise<Result<ScanInfo>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("scan_tag", { p_tag: normalizeTag(rawTag) });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: data as ScanInfo };
}

export async function completeOrder(orderId: string, empties: number, paid: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_order", {
    p_order_id: orderId,
    p_empties: empties,
    p_paid: paid,
  });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function markPaid(orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_paid", { p_order_id: orderId });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function settleOrderContainers(orderId: string, qty: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_order_containers", { p_order_id: orderId, p_qty: Math.round(qty) });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function deleteOrder(orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_order", { p_order_id: orderId });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: null };
}
