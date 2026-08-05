"use client";

import ReactSelect from "react-select";
import { selectStyles } from "./selectStyles";

export default function Select({
  value,
  onChange,
  options,
  placeholder = "انتخاب کنید",
  isClearable = false,
  isSearchable = false,
  isDisabled = false,
  instanceId,
  className = "",
  width = "100%",
}) {
  const selected =
    options.find((item) => item.value === value) || null;

  return (
    <div
      className={className}
      style={{ width }}
      dir="rtl"
    >
      <ReactSelect
        instanceId={instanceId}
        inputId={instanceId}
        value={selected}
        onChange={(option) => onChange(option?.value || "")}
        options={options}
        placeholder={placeholder}
        isClearable={isClearable}
        isSearchable={isSearchable}
        isDisabled={isDisabled}
        isRtl
        styles={selectStyles}
        menuPortalTarget={
          typeof window !== "undefined"
            ? document.body
            : undefined
        }
      />
    </div>
  );
}