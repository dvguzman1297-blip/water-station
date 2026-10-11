"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Action = (fd: FormData) => void | Promise<void>;

export function ConfirmDelete({
  action, id, back, message, label, text,
}: {
  action: Action; id: string; back?: string; message: string; label: string; text?: string;
}) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      {back && <input type="hidden" name="back" value={back} />}
      <Button variant="danger" size="sm" type="submit" aria-label={label}>
        <Trash2 className="h-4 w-4" /> {text}
      </Button>
    </form>
  );
}
