# Water Station

Orders, deliveries, and inventory for a water refilling station. Next.js (App Router) + Supabase + Tailwind.

## Setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `0002_order_tags.sql`.
3. In Authentication > Users, create your own user, then run:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
4. Copy `.env.example` to `.env.local` and fill in the three values. The service-role key is only used by the "Create account" and "Remove" actions in Settings.
5. `npm install` then `npm run dev`.
6. Open Settings and replace the placeholder prices and costs with your real ones.
7. Deploy to Vercel and add the same three environment variables.

Camera scanning needs HTTPS (Vercel provides it) or `localhost`.

## How scan-to-state works

All order changes go through Postgres functions, so staff cannot skip steps from the browser.

Every order gets its own QR tag (`ORD-0042`) the moment it is saved. The app shows it right away: scan it off the screen or tap Print and attach the label to the order. Status can also be changed by hand with the buttons on the order card.

| Scan | Result |
| --- | --- |
| Tag on a pending order | Order becomes Out for delivery |
| Tag on an out-for-delivery order | Confirm dialog: empties returned, payment received, then Delivered |
| Tag of a delivered or cancelled order | "Already delivered/cancelled" |
| Unknown tag | Error |

You can also type the order number in the scan dialog if the camera is not available.

## Changes from the original spec

- `products` table holds prices and the four cost parts; `create_order` snapshots cost into `order_costs`.
- Cost data (`products`, `order_costs`, `expenses`, reports) is admin-only through RLS. Staff read prices through the `products_public` view.
- `qr_tags` holds one generated tag per order; a unique column guarantees one live order per tag.
- `dispatched_at`, `delivered_at`, `paid_at` timestamps added.
- "Pay later" is supported: the order is Delivered but Unpaid and stays in the Delivered tab until marked paid.
- `customers.container_balance` changes on completion by (containers delivered minus empties returned).
- Products can link to an inventory item that drops by one per gallon delivered (default: Caps & Seals).
- Net margin in reports = revenue minus recorded expenses. Estimated COGS is shown beside it, not subtracted twice.
- Month boundaries use Asia/Manila time.

## Not done / next

- Not build-tested in the authoring environment (no network). Run `npm install && npm run build` first and fix any type nits.
- No automated tests, offline mode, or SMS/receipt printing.
