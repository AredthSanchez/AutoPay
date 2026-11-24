/**
 * Displays a dropdown with a button to clear or reset the choice.
 * The screen using this dropdown can keep track of the choice itself, or let this component
 * remember it.
 */
import React, { Children, useState } from "react";
// Clicking clear chooses resetValue, usually an empty choice, and notifies the screen just like
// choosing a dropdown option.
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
