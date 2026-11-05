"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * A button for actions that are hard to undo (cancel a project, remove a member).
 * The first click asks "Are you sure?" in place; the second one runs the action.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  size = "md",
  disabled,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {asking ? (
        <motion.span
          key="ask"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-2.5 py-1.5"
          role="alertdialog"
          aria-label={question}
        >
          <span className="text-xs text-danger">{question}</span>
          <Button size="sm" variant="danger-outline" loading={busy} onClick={run} autoFocus>
            {confirmLabel}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
            Keep
          </Button>
        </motion.span>
      ) : (
        <motion.span key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Button size={size} variant="danger-outline" disabled={disabled} onClick={() => setAsking(true)}>
            {label}
          </Button>
        </motion.span>
      )}
    </AnimatePresence>
  );
}
