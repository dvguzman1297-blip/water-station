"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Action = (fd: FormData) => void | Promise<void>;

export function StaffRow({
  id, name, role, isMe, setPassword, setRole, remove,
}: {
  id: string; name: string; role: string; isMe: boolean;
  setPassword: Action; setRole: Action; remove: Action;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="glass flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl p-3">
      <div className="min-w-0">
        <p className="truncate font-bold">{name}</p>
        <p className="text-sm text-navy/60">{role === "admin" ? "Admin" : "Staff"}{isMe ? " (you)" : ""}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Reset password"}
        </Button>
        {!isMe && (
          <>
            <form action={setRole}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="role" value={role === "admin" ? "staff" : "admin"} />
              <Button variant="outline" size="sm" type="submit">Make {role === "admin" ? "staff" : "admin"}</Button>
            </form>
            <form action={remove}>
              <input type="hidden" name="id" value={id} />
              <Button variant="danger" size="sm" type="submit">Remove</Button>
            </form>
          </>
        )}
      </div>
      {open && (
        <form action={setPassword} className="flex w-full gap-2 border-t border-navy/10 pt-3">
          <input type="hidden" name="id" value={id} />
          <input
            name="password" type="text" minLength={8} required autoFocus autoComplete="off"
            placeholder="New password (8+ characters)" aria-label={`New password for ${name}`}
            className="field"
          />
          <Button type="submit" className="shrink-0">Save</Button>
        </form>
      )}
    </li>
  );
}
