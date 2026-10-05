"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export async function createCustomer(input: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<Result<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return fail("Enter the customer's name.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ name, phone: input.phone?.trim() || null, address: input.address?.trim() || null })
    .select("id")
    .single();
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: { id: data.id } };
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

export async function cancelOrder(orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) return fail(error.message);
  revalidatePath("/");
  return { ok: true, data: null };
}
