import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from "react";
import {
  BellRing,
  Cable,
  CircleAlert,
  CircleCheckBig,
  Copy,
  EllipsisVertical,
  History,
  Inbox,
  Info,
  KeyRound,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Sun,
  Trash2,
  TriangleAlert,
  UserRoundX,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button as ShadButton } from "@/components/ui/button";
import {
  Card as ShadCard,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const iconMap: Record<string, LucideIcon> = {
  add: Plus,
  bolt: Zap,
  check_circle: CircleCheckBig,
  close: X,
  content_copy: Copy,
  dark_mode: Moon,
  delete: Trash2,
  dns: Server,
  error: CircleAlert,
  group: Users,
  group_off: UserRoundX,
  history: History,
  history_toggle_off: History,
  inbox: Inbox,
  info: Info,
  light_mode: Sun,
  logout: LogOut,
  menu: Menu,
  more_vert: EllipsisVertical,
  person_off: UserRoundX,
  qr_code_2: QrCode,
  receipt_long: ReceiptText,
  restart_alt: RotateCcw,
  search: BellRing,
  settings: Settings,
  settings_ethernet: Cable,
  space_dashboard: LayoutGrid,
  sync: RefreshCw,
  vpn_key: KeyRound,
  vpn_key_off: KeyRound,
  warning: TriangleAlert,
};

export { cn };

type MaterialIconProps = {
  name: string;
  filled?: boolean;
  className?: string;
};

export function MaterialIcon({ name, className }: MaterialIconProps) {
  const Icon = iconMap[name] || Info;
  return <Icon aria-hidden className={cn("size-4", className)} />;
}

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
};

function mapButtonVariant(variant: ButtonVariant): "default" | "secondary" | "outline" | "ghost" | "destructive" {
  if (variant === "tonal" || variant === "elevated") {
    return "secondary";
  }

  if (variant === "outlined") {
    return "outline";
  }

  if (variant === "text") {
    return "ghost";
  }

  if (variant === "danger") {
    return "destructive";
  }

  return "default";
}

export function Button({
  variant = "filled",
  icon,
  trailingIcon,
  className,
  children,
  fullWidth = false,
  ...props
}: ButtonProps) {
  return (
    <ShadButton
      variant={mapButtonVariant(variant)}
      className={cn(fullWidth && "w-full", className)}
      {...props}
    >
      {icon && <MaterialIcon name={icon} className="size-4" />}
      <span>{children}</span>
      {trailingIcon && <MaterialIcon name={trailingIcon} className="size-4" />}
    </ShadButton>
  );
}

type IconButtonVariant = "standard" | "filled" | "tonal" | "outlined";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: string;
  label: string;
  variant?: IconButtonVariant;
};

export function IconButton({ icon, label, variant = "standard", className, ...props }: IconButtonProps) {
  const resolvedVariant = variant === "outlined" ? "outline" : variant === "filled" ? "default" : "ghost";

  return (
    <ShadButton
      type="button"
      size="icon"
      variant={resolvedVariant}
      className={className}
      aria-label={label}
      title={label}
      {...props}
    >
      <MaterialIcon name={icon} className="size-4" />
    </ShadButton>
  );
}

type StatusTone = "neutral" | "success" | "warning" | "error" | "info";

type StatusBadgeProps = {
  tone?: StatusTone;
  children?: ReactNode;
  icon?: string;
  enabled?: boolean;
  trueLabel?: string;
  falseLabel?: string;
};

function statusToneClass(tone: StatusTone): string {
  if (tone === "success") {
    return "border-border bg-secondary text-secondary-foreground";
  }

  if (tone === "warning") {
    return "border-border bg-accent text-accent-foreground";
  }

  if (tone === "error") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  if (tone === "info") {
    return "border-border bg-muted text-muted-foreground";
  }

  return "border-border bg-muted text-muted-foreground";
}

export function StatusBadge({
  tone = "neutral",
  children,
  icon,
  enabled,
  trueLabel = "Enabled",
  falseLabel = "Disabled",
}: StatusBadgeProps) {
  const resolvedTone = enabled === undefined ? tone : enabled ? "success" : "error";
  const label = children || (enabled === undefined ? "-" : enabled ? trueLabel : falseLabel);

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", statusToneClass(resolvedTone))}>
      {icon && <MaterialIcon name={icon} className="size-3.5" />}
      {label}
    </Badge>
  );
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="max-w-4xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      </div>
      {(actions || meta) && (
        <div className="flex w-full flex-col items-start gap-2 lg:w-auto lg:items-end">
          {actions && <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">{actions}</div>}
          {meta && <div className="text-xs text-muted-foreground sm:text-sm">{meta}</div>}
        </div>
      )}
    </header>
  );
}

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  outlined?: boolean;
}>;

export function Card({ title, subtitle, action, className, children, outlined = false }: CardProps) {
  return (
    <ShadCard className={cn(outlined && "bg-background", className)}>
      {(title || subtitle || action) && (
        <CardHeader>
          <div className="space-y-1">
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </div>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadCard>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <ShadCard className="border border-border/70 bg-card">
      <CardContent className="space-y-2 p-5">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</div>
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </ShadCard>
  );
}

type MessageTone = "info" | "warning" | "error" | "success";

type InlineMessageProps = {
  tone?: MessageTone;
  children: ReactNode;
};

export function InlineMessage({ tone = "info", children }: InlineMessageProps) {
  const toneMeta: Record<MessageTone, { title: string; className: string; icon: string }> = {
    info: {
      title: "Info",
      className: "border-border bg-muted text-foreground",
      icon: "info",
    },
    warning: {
      title: "Warning",
      className: "border-border bg-accent text-accent-foreground",
      icon: "warning",
    },
    error: {
      title: "Error",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: "error",
    },
    success: {
      title: "Success",
      className: "border-border bg-secondary text-secondary-foreground",
      icon: "check_circle",
    },
  };

  return (
    <Alert className={cn("gap-3", toneMeta[tone].className)}>
      <MaterialIcon name={toneMeta[tone].icon} className="mt-0.5 size-4" />
      <div className="space-y-1">
        <AlertTitle>{toneMeta[tone].title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </div>
    </Alert>
  );
}

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon = "inbox", action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MaterialIcon name={icon} className="size-5" />
      </div>
      <p className="text-base font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

type LinearProgressProps = {
  value?: number;
  indeterminate?: boolean;
};

export function LinearProgress({ value = 0, indeterminate = false }: LinearProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-300",
          indeterminate && "w-2/5 animate-[pulse_1.2s_ease-in-out_infinite]"
        )}
        style={{ width: indeterminate ? undefined : `${clamped}%` }}
      />
    </div>
  );
}

export function CircularProgress() {
  return <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />;
}

type BaseFieldProps = {
  label: string;
  supportingText?: string;
  errorText?: string;
  className?: string;
};

type TextFieldProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, supportingText, errorText, className, ...props }: TextFieldProps) {
  const fieldId = props.id || useId();
  const helperId = `${fieldId}-help`;
  const hasHelper = Boolean(errorText || supportingText);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={fieldId}
        aria-invalid={Boolean(errorText)}
        aria-describedby={hasHelper ? helperId : undefined}
        {...props}
      />
      {hasHelper && (
        <p id={helperId} role={errorText ? "alert" : undefined} className={cn("text-xs", errorText ? "text-destructive" : "text-muted-foreground")}>
          {errorText || supportingText}
        </p>
      )}
    </div>
  );
}

type SelectFieldProps = BaseFieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ value: string; label: string }>;
  };

export function SelectField({ label, supportingText, errorText, className, options, ...props }: SelectFieldProps) {
  const fieldId = props.id || useId();
  const helperId = `${fieldId}-help`;
  const hasHelper = Boolean(errorText || supportingText);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </Label>
      <select
        id={fieldId}
        aria-invalid={Boolean(errorText)}
        aria-describedby={hasHelper ? helperId : undefined}
        className={cn(
          "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasHelper && (
        <p id={helperId} role={errorText ? "alert" : undefined} className={cn("text-xs", errorText ? "text-destructive" : "text-muted-foreground")}>
          {errorText || supportingText}
        </p>
      )}
    </div>
  );
}

type TextareaFieldProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({ label, supportingText, errorText, className, ...props }: TextareaFieldProps) {
  const fieldId = props.id || useId();
  const helperId = `${fieldId}-help`;
  const hasHelper = Boolean(errorText || supportingText);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </Label>
      <Textarea
        id={fieldId}
        aria-invalid={Boolean(errorText)}
        aria-describedby={hasHelper ? helperId : undefined}
        {...props}
      />
      {hasHelper && (
        <p id={helperId} role={errorText ? "alert" : undefined} className={cn("text-xs", errorText ? "text-destructive" : "text-muted-foreground")}>
          {errorText || supportingText}
        </p>
      )}
    </div>
  );
}

type SwitchFieldProps = {
  label: string;
  supportingText?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function SwitchField({ label, supportingText, checked, onChange, disabled = false }: SwitchFieldProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 p-3">
      <span className="space-y-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {supportingText && <span className="block text-xs text-muted-foreground">{supportingText}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
    </label>
  );
}



