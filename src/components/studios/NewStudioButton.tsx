"use client";

import { useState } from "react";
import { NewStudioModal } from "@/components/studios/NewStudioModal";

export function NewStudioButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        + New studio
      </button>
      <NewStudioModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
