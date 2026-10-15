"use client";
import { useId, type ReactNode } from "react";

// Accessible on/off switch for binary settings. A native <button role="switch"> gives keyboard
// support (Space and Enter) and screen-reader state; clicking the label also toggles it.
// Use checkboxes, not this, for choosing several items from a list.
export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  badge,
  hideLabel = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className={`aaa-switch-row ${disabled ? "is-disabled" : ""}`}>
      <div className="aaa-switch-text">
        <span className={hideLabel ? "sr-only" : "aaa-switch-label"}>
          <label htmlFor={id}>{label}</label>
          {badge}
        </span>
        {description && <small id={`${id}-description`}>{description}</small>}
      </div>
      <span className="aaa-switch-state" aria-hidden="true">{checked ? "On" : "Off"}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        className="aaa-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="aaa-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}
