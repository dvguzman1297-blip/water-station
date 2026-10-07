export type Status = "pending" | "out_for_delivery" | "delivered" | "cancelled";
export type PaymentStatus = "paid" | "unpaid";

export type OrderRow = {
  id: string;
  order_number: number;
  total_amount: number;
  status: Status;
  payment_status: PaymentStatus;
  qr_tag_id: string | null;
  created_at: string;
  empties_returned: number | null;
  customers: { name: string; phone: string | null; address: string | null } | null;
  order_items: { container_type: string; quantity: number }[];
};

export type Customer = { id: string; name: string; phone: string | null; address: string | null };
export type PublicProduct = { code: string; name: string; price: number };

export type ScanInfo = {
  action: "unknown" | "free" | "closed" | "dispatched" | "confirm_delivery";
  tag: string;
  status?: Status;
  order_id?: string;
  order_number?: number;
  customer?: string;
  total?: number;
  quantity?: number;
  payment_status?: PaymentStatus;
};

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
