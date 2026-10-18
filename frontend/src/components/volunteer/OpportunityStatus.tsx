"use client";

import { AnimatePresence, motion } from "motion/react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ApplicationStatus, Opportunity } from "@/lib/types";
import { useVolunteer } from "./VolunteerProvider";

const statusBadges: Partial<Record<ApplicationStatus, { tone: Tone; label: string }>> = {
  pending: { tone: "warning", label: "Application pending" },
  approved: { tone: "success", label: "Approved" },
  registered: { tone: "success", label: "Registered" },
  waitlisted: { tone: "neutral", label: "Waitlisted" },
};

/** Badge for the volunteer's status, or "Full" when there is no status and no spots left. */
export function StatusBadge({ opportunity, short = false }: { opportunity: Opportunity; short?: boolean }) {
  const { statusOf, registeredCount } = useVolunteer();
  const status = statusOf(opportunity.id);
  const full = registeredCount(opportunity) >= opportunity.volunteersNeeded;
  const badge =
    statusBadges[status] ?? (full ? { tone: "danger" as const, label: "Full" } : null);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {badge && (
        <motion.span
          key={badge.label}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.25 }}
        >
          <Badge tone={badge.tone}>
            {short && status === "approved" ? "Approved · register to confirm" : badge.label}
          </Badge>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** The main action for the current status (Apply → Withdraw → Register → Cancel...). */
export function PrimaryAction({
  opportunity,
  size = "md",
  className,
  wording = "short",
}: {
  opportunity: Opportunity;
  size?: "sm" | "md" | "lg";
  className?: string;
  wording?: "short" | "long";
}) {
  const { statusOf, act, registeredCount } = useVolunteer();
  const status = statusOf(opportunity.id);
  const full = registeredCount(opportunity) >= opportunity.volunteersNeeded;
  const long = wording === "long";

  const config = (() => {
    switch (status) {
      case "pending":
        return { label: long ? "Withdraw application" : "Withdraw", variant: "danger-outline", action: "withdraw" } as const;
      case "approved":
        return full
          ? ({ label: "Event full", variant: "outline", action: null } as const)
          : ({ label: long ? "Register for event" : "Register", variant: "brand", action: "register" } as const);
      case "registered":
        return { label: "Cancel participation", variant: "danger-outline", action: "cancel" } as const;
      case "waitlisted":
        return { label: "Leave waitlist", variant: "outline", action: "leaveWaitlist" } as const;
      default:
        return full
          ? ({ label: "Join waitlist", variant: "outline", action: "joinWaitlist" } as const)
          : ({ label: long ? "Apply to volunteer" : "Apply", variant: "primary", action: "apply" } as const);
    }
  })();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={config.label}
        className={className}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
        transition={{ duration: 0.2 }}
      >
        <Button
          variant={config.variant}
          size={size}
          className="w-full"
          disabled={!config.action}
          onClick={() => config.action && act(opportunity.id, config.action)}
        >
          {config.label}
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
