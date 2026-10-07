"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function adminCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/");
  return { supabase, user };
}

function done(path: string, error?: string | null): never {
  revalidatePath(path.split("?")[0]);
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
}

const num = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

// ───────── Products / pricing ─────────
export async function updateProduct(fd: FormData) {
  const { supabase } = await adminCtx();
  const { error } = await supabase
    .from("products")
    .update({
      name: str(fd.get("name")),
      price: num(fd.get("price")),
      cogs_water: num(fd.get("cogs_water")),
      cogs_power: num(fd.get("cogs_power")),
      cogs_caps: num(fd.get("cogs_caps")),
      cogs_delivery: num(fd.get("cogs_delivery")),
      inventory_item_id: str(fd.get("inventory_item_id")) || null,
      active: fd.get("active") === "on",
    })
    .eq("code", str(fd.get("code")));
  done("/admin/settings?tab=prices", error?.message);
}

export async function addProduct(fd: FormData) {
  const { supabase } = await adminCtx();
  const code = str(fd.get("code")).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (!code || !str(fd.get("name"))) done("/admin/settings?tab=prices", "Enter a name and a code.");
  const { error } = await supabase
    .from("products")
    .insert({ code, name: str(fd.get("name")), price: num(fd.get("price")), sort_order: 99 });
  done("/admin/settings?tab=prices", error?.message);
}

// ───────── Expense categories and entries ─────────
export async function addCategory(fd: FormData) {
  const { supabase } = await adminCtx();
  const name = str(fd.get("name"));
  if (!name) done("/admin/settings?tab=categories", "Enter a category name.");
  const { error } = await supabase.from("expense_categories").insert({ name });
  done("/admin/settings?tab=categories", error?.message);
}

export async function removeCategory(fd: FormData) {
  const { supabase } = await adminCtx();
  const { error } = await supabase.from("expense_categories").delete().eq("name", str(fd.get("name")));
  done("/admin/settings?tab=categories", error?.message);
}

export async function addExpense(fd: FormData) {
  const { supabase, user } = await adminCtx();
  const amount = num(fd.get("amount"));
  if (amount <= 0) done("/admin/expenses", "Enter an amount above zero.");
  const { error } = await supabase.from("expenses").insert({
    category: str(fd.get("category")),
    amount,
    expense_date: str(fd.get("expense_date")) || undefined,
    notes: str(fd.get("notes")) || null,
    created_by: user.id,
  });
  done("/admin/expenses", error?.message);
}

export async function deleteExpense(fd: FormData) {
  const { supabase } = await adminCtx();
  const { error } = await supabase.from("expenses").delete().eq("id", str(fd.get("id")));
  done("/admin/expenses", error?.message);
}

// ───────── Staff accounts (needs the service-role key) ─────────
export async function createStaff(fd: FormData) {
  await adminCtx();
  const email = str(fd.get("email"));
  const password = str(fd.get("password"));
  const full_name = str(fd.get("full_name"));
  const role = str(fd.get("role")) === "admin" ? "admin" : "staff";
  if (!email || password.length < 8 || !full_name) done("/admin/settings?tab=staff", "Name, email, and a password of 8+ characters are required.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) done("/admin/settings?tab=staff", error.message);
  if (role === "admin" && data.user) {
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  }
  done("/admin/settings?tab=staff");
}

export async function setStaffRole(fd: FormData) {
  const { supabase, user } = await adminCtx();
  const id = str(fd.get("id"));
  if (id === user.id) done("/admin/settings?tab=staff", "You can't change your own role.");
  const role = str(fd.get("role")) === "admin" ? "admin" : "staff";
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  done("/admin/settings?tab=staff", error?.message);
}

export async function removeStaff(fd: FormData) {
  const { user } = await adminCtx();
  const id = str(fd.get("id"));
  if (id === user.id) done("/admin/settings?tab=staff", "You can't remove your own account.");
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  done("/admin/settings?tab=staff", error?.message);
}

export async function setStaffPassword(fd: FormData) {
  await adminCtx();
  const id = str(fd.get("id"));
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) done("/admin/settings?tab=staff", "Password must be at least 8 characters.");
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  done("/admin/settings?tab=staff", error?.message);
}

export async function settleOrderContainers(fd: FormData) {
  const { supabase } = await adminCtx();
  const { error } = await supabase.rpc("settle_order_containers", {
    p_order_id: str(fd.get("order_id")),
    p_qty: Math.round(num(fd.get("qty"))),
  });
  done("/admin/reports?tab=gallons", error?.message);
}

export async function settleContainers(fd: FormData) {
  const { supabase } = await adminCtx();
  const iso = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(fd.get(k))) ? str(fd.get(k)) : "");
  const qs = new URLSearchParams({ tab: "gallons" });
  if (iso("from")) qs.set("from", iso("from"));
  if (iso("to")) qs.set("to", iso("to"));
  const path = `/admin/reports?${qs}`;
  const { error } = await supabase.rpc("settle_containers", {
    p_customer_id: str(fd.get("customer_id")),
    p_qty: Math.round(num(fd.get("qty"))),
  });
  done(path, error?.message);
}

// ───────── Inventory ─────────
export async function saveInventoryItem(fd: FormData) {
  const { supabase } = await adminCtx();
  const id = str(fd.get("id"));
  const row = {
    item_name: str(fd.get("item_name")),
    stock_quantity: Math.round(num(fd.get("stock_quantity"))),
    unit_cost: num(fd.get("unit_cost")),
    reorder_level: Math.round(num(fd.get("reorder_level"))),
  };
  if (!row.item_name) done("/admin/inventory", "Enter an item name.");
  const { error } = id
    ? await supabase.from("inventory_items").update(row).eq("id", id)
    : await supabase.from("inventory_items").insert(row);
  done("/admin/inventory", error?.message);
}
