"use client";

import { type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FieldBaseProps = {
  label: string;
  description?: string;
  error?: string;
  className?: string;
};

function FieldMessage({ id, description, error }: { id: string; description?: string; error?: string }) {
  if (!description && !error) {
    return null;
  }

  return (
    <p id={id} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
      {error || description}
    </p>
  );
}

export type TextFieldProps = FieldBaseProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, description, error, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  const messageId = `${fieldId}-message`;
  const hasMessage = Boolean(description || error);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <Input id={fieldId} aria-invalid={Boolean(error)} aria-describedby={hasMessage ? messageId : undefined} {...props} />
      <FieldMessage id={messageId} description={description} error={error} />
    </div>
  );
}

export type TextareaFieldProps = FieldBaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({ label, description, error, className, id, ...props }: TextareaFieldProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  const messageId = `${fieldId}-message`;
  const hasMessage = Boolean(description || error);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <Textarea id={fieldId} aria-invalid={Boolean(error)} aria-describedby={hasMessage ? messageId : undefined} {...props} />
      <FieldMessage id={messageId} description={description} error={error} />
    </div>
  );
}

export type SelectFieldOption = {
  value: string;
  label: string;
};

export type SelectFieldProps = FieldBaseProps & {
  value: string;
  options: SelectFieldOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SelectField({
  label,
  description,
  error,
  className,
  value,
  options,
  onValueChange,
  placeholder = "Select value",
  disabled = false,
}: SelectFieldProps) {
  const fieldId = useId();
  const messageId = `${fieldId}-message`;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <Select value={value || null} onValueChange={(nextValue) => onValueChange(nextValue || "")} disabled={disabled}>
        <SelectTrigger id={fieldId} className={cn("w-full", error && "border-destructive focus-visible:ring-destructive/20")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldMessage id={messageId} description={description} error={error} />
    </div>
  );
}
