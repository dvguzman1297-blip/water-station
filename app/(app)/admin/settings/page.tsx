import { Receipt, Tag, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addCategory, addProduct, createStaff, removeCategory, removeStaff,
  setStaffPassword, setStaffRole, updateProduct,
} from "../actions";
import { Button } from "@/components/ui/button";
import { StaffRow } from "@/components/staff-row";
import { SectionNav } from "@/components/section-nav";
import { Flash } from "@/components/flash";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "prices", label: "Prices & costs", icon: Tag },
  { id: "categories", label: "Expense categories", icon: Receipt },
  { id: "staff", label: "Staff accounts", icon: Users },
] as const;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {hint && <p className="text-sm text-navy/70">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; tab?: string }> }) {
  const me = await requireAdmin();
  const { error, tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "prices";
  const supabase = await createClient();
  const [products, items, cats, staff] = await Promise.all([
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("inventory_items").select("id, item_name").order("item_name"),
    supabase.from("expense_categories").select("name").order("name"),
    supabase.from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
        <SectionNav base="/admin/settings" tabs={TABS} current={tab} label="Settings sections" />
        <div className="min-w-0 space-y-4">
          <Flash error={error} />
          {tab === "prices" && (
            <Section title="Prices and costs" hint="Cost per unit feeds the margin tracker. Hidden gallon types disappear from the order screen.">
              <div className="grid gap-3 md:grid-cols-2">
                {(products.data ?? []).map((p) => (
                  <form key={p.code} action={updateProduct} className="glass grid grid-cols-2 gap-3 rounded-2xl p-4">
                    <input type="hidden" name="code" value={p.code} />
                    <div className="col-span-2">
                      <label className="label" htmlFor={`pn-${p.code}`}>Name</label>
                      <input id={`pn-${p.code}`} name="name" defaultValue={p.name} className="field" required />
                    </div>
                    {[
                      ["price", "Selling price (₱)", p.price],
                      ["cogs_water", "Water intake (₱)", p.cogs_water],
                      ["cogs_power", "Power (₱)", p.cogs_power],
                      ["cogs_caps", "Caps & seals (₱)", p.cogs_caps],
                      ["cogs_delivery", "Delivery share (₱)", p.cogs_delivery],
                    ].map(([n, l, v]) => (
                      <div key={String(n)}>
                        <label className="label" htmlFor={`${n}-${p.code}`}>{String(l)}</label>
                        <input id={`${n}-${p.code}`} name={String(n)} type="number" step="0.01" min="0" defaultValue={Number(v)} className="field" />
                      </div>
                    ))}
                    <div>
                      <label className="label" htmlFor={`inv-${p.code}`}>Uses stock item</label>
                      <select id={`inv-${p.code}`} name="inventory_item_id" defaultValue={p.inventory_item_id ?? ""} className="field">
                        <option value="">None</option>
                        {(items.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                      </select>
                    </div>
                    <label className="col-span-2 flex min-h-12 items-center gap-3 font-semibold">
                      <input type="checkbox" name="active" defaultChecked={p.active} className="h-6 w-6 accent-sky-600" /> Show on order screen
                    </label>
                    <Button type="submit" className="col-span-2">Save {p.name}</Button>
                  </form>
                ))}
              </div>
              <form action={addProduct} className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-4">
                <input name="name" placeholder="New gallon type" aria-label="New gallon type name" className="field sm:col-span-2" required />
                <input name="code" placeholder="code, e.g. mini_3gal" aria-label="Code" className="field" required />
                <input name="price" type="number" step="0.01" placeholder="Price" aria-label="Price" className="field" required />
                <Button type="submit" variant="outline" className="sm:col-span-4">Add gallon type</Button>
              </form>
            </Section>
          )}
          {tab === "categories" && (
            <Section title="Expense categories" hint="These appear when you record an expense.">
              <div className="flex flex-wrap gap-2">
                {(cats.data ?? []).map((c) => (
                  <form key={c.name} action={removeCategory} className="glass flex items-center gap-1 rounded-full py-1 pl-4 pr-1">
                    <span className="font-semibold">{c.name}</span>
                    <input type="hidden" name="name" value={c.name} />
                    <button className="grid h-10 w-10 place-items-center rounded-full text-navy/60 hover:bg-navy/10" aria-label={`Remove ${c.name}`}>×</button>
                  </form>
                ))}
              </div>
              <form action={addCategory} className="flex gap-2">
                <input name="name" placeholder="New category" aria-label="New category" className="field" required />
                <Button type="submit" variant="outline">Add</Button>
              </form>
            </Section>
          )}
          {tab === "staff" && (
            <Section title="Staff accounts" hint="Staff see orders only. Admins also see money, reports, and settings.">
              <ul className="space-y-2">
                {(staff.data ?? []).map((s) => (
                  <StaffRow
                    key={s.id} id={s.id} name={s.full_name} role={s.role} isMe={s.id === me.id}
                    setPassword={setStaffPassword} setRole={setStaffRole} remove={removeStaff}
                  />
                ))}
              </ul>
              <form action={createStaff} className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
                <input name="full_name" placeholder="Full name" aria-label="Full name" className="field" required />
                <input name="email" type="email" placeholder="Email (used to sign in)" aria-label="Email" className="field" required />
                <input name="password" type="text" minLength={8} placeholder="Starting password (8+ characters)" aria-label="Starting password" className="field" required />
                <select name="role" aria-label="Role" className="field" defaultValue="staff">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit" className="sm:col-span-2">Create account</Button>
              </form>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
