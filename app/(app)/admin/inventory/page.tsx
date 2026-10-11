import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveInventoryItem } from "../actions";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/flash";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_items").select("*").order("item_name");
  const items = data ?? [];
  const low = items.filter((i) => i.stock_quantity <= i.reorder_level);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Stock</h1>
      <Flash error={error} />
      {low.length > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 font-semibold text-amber-900 ring-1 ring-amber-300">
          <AlertTriangle className="h-5 w-5" /> Reorder soon: {low.map((i) => i.item_name).join(", ")}
        </p>
      )}
      <p className="text-sm text-navy/70">Items linked to a gallon type in Settings go down by one for each gallon delivered.</p>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <form key={i.id} action={saveInventoryItem} className={cn("glass grid grid-cols-2 gap-3 rounded-2xl p-4", i.stock_quantity <= i.reorder_level && "ring-2 ring-amber-400")}>
            <input type="hidden" name="id" value={i.id} />
            <div className="col-span-2">
              <label className="label" htmlFor={`n-${i.id}`}>Item</label>
              <input id={`n-${i.id}`} name="item_name" defaultValue={i.item_name} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor={`s-${i.id}`}>In stock</label>
              <input id={`s-${i.id}`} name="stock_quantity" type="number" defaultValue={i.stock_quantity} className="field" />
            </div>
            <div>
              <label className="label" htmlFor={`r-${i.id}`}>Reorder at</label>
              <input id={`r-${i.id}`} name="reorder_level" type="number" defaultValue={i.reorder_level} className="field" />
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor={`c-${i.id}`}>Cost each (₱)</label>
              <input id={`c-${i.id}`} name="unit_cost" type="number" step="0.01" defaultValue={i.unit_cost} className="field" />
            </div>
            <Button type="submit" className="col-span-2">Save</Button>
          </form>
        ))}
      </div>

      <form action={saveInventoryItem} className="glass grid grid-cols-2 gap-3 rounded-2xl p-4">
        <h2 className="col-span-2 text-lg font-bold">Add an item</h2>
        <div className="col-span-2"><label className="label" htmlFor="new-name">Item</label><input id="new-name" name="item_name" className="field" required /></div>
        <div><label className="label" htmlFor="new-stock">In stock</label><input id="new-stock" name="stock_quantity" type="number" defaultValue={0} className="field" /></div>
        <div><label className="label" htmlFor="new-reorder">Reorder at</label><input id="new-reorder" name="reorder_level" type="number" defaultValue={10} className="field" /></div>
        <div className="col-span-2"><label className="label" htmlFor="new-cost">Cost each (₱)</label><input id="new-cost" name="unit_cost" type="number" step="0.01" defaultValue={0} className="field" /></div>
        <Button type="submit" variant="outline" className="col-span-2">Add item</Button>
      </form>
    </div>
  );
}
