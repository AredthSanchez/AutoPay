/**
 * Select with a clear action. Supports a parent-controlled value or internal state seeded by defaultValue.
 */
import React, { Children, useState } from "react";
// The clear control sends resetValue through the same onChange contract as the select.
export default function ClearableSelect({
  children,
  value,
  defaultValue,
  onChange,
  resetValue = "",
  clearLabel,
  disabled,
  ...props
}) {
  const options = Children.toArray(children),
    first = options.find((child) => child?.type === "option");
  const [internal, setInternal] = useState(
    defaultValue ?? first?.props?.value ?? first?.props?.children ?? "",
  );
  const selected = value ?? internal;
  const change = (event) => {
    setInternal(event.target.value);
    onChange?.(event);
  };
  const hasEmpty = options.some((child) => child?.type === "option" && child.props.value === "");
  return (
    <span className="clearable-select">
      <select {...props} disabled={disabled} value={selected} onChange={change}>
        {resetValue === "" && !hasEmpty && <option value="">Choose an option</option>}
        {children}
      </select>
      <button
        className="select-clear"
        type="button"
        aria-label={clearLabel || "Clear " + (props["aria-label"] || props.name || "selection")}
        title="Clear selection"
        disabled={disabled || String(selected) === String(resetValue)}
        onClick={() =>
          change({
            target: { value: String(resetValue) },
            currentTarget: { value: String(resetValue) },
          })
        }
      >
        ×
      </button>
    </span>
  );
}
