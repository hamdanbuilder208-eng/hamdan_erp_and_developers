import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import type {
  UnitStatus,
  ProjectStatus,
  LandPropertyStatus,
  BookingStatus,
  PurchaseOrderStatus,
  MaterialIssueStatus,
} from "../../types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        info: "bg-info-50 text-info-700",
        neutral: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300",
        purple: "bg-onhold-50 text-onhold-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  children,
}: { className?: string; children: React.ReactNode } & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

const unitStatusTone: Record<UnitStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  Available: "success",
  Booked: "warning",
  Sold: "info",
  Cancelled: "danger",
  "On-Hold": "purple",
};

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return <Badge tone={unitStatusTone[status]}>{status}</Badge>;
}

const projectStatusTone: Record<ProjectStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  Active: "success",
  Inactive: "neutral",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={projectStatusTone[status]}>{status}</Badge>;
}

const landStatusTone: Record<LandPropertyStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  Available: "success",
  Reserved: "warning",
  Sold: "info",
};

export function LandPropertyStatusBadge({ status }: { status: LandPropertyStatus }) {
  return <Badge tone={landStatusTone[status]}>{status}</Badge>;
}

const bookingStatusTone: Record<BookingStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  Booked: "warning",
  Confirmed: "info",
  "Possession Given": "success",
  Cancelled: "danger",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={bookingStatusTone[status]}>{status}</Badge>;
}

const purchaseOrderStatusTone: Record<PurchaseOrderStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  Draft: "neutral",
  Approved: "info",
  Closed: "success",
  Cancelled: "danger",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge tone={purchaseOrderStatusTone[status]}>{status}</Badge>;
}

const materialIssueStatusTone: Record<MaterialIssueStatus, VariantProps<typeof badgeVariants>["tone"]> = {
  Dispatched: "warning",
  Received: "success",
};

export function MaterialIssueStatusBadge({ status }: { status: MaterialIssueStatus }) {
  return <Badge tone={materialIssueStatusTone[status]}>{status}</Badge>;
}
