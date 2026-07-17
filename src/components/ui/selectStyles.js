export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 10,
    borderColor: state.isFocused ? "#000" : "#e5e7eb",
    boxShadow: "none",
    direction: "rtl",
    fontSize: "14px",
    "&:hover": {
      borderColor: "#000",
    },
  }),

  menu: (base) => ({
    ...base,
    zIndex: 9999,
    direction: "rtl",
    textAlign: "right",
  }),

  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),

  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#000"
      : state.isFocused
      ? "#f3f4f6"
      : "#fff",
    color: state.isSelected ? "#fff" : "#111827",
    cursor: "pointer",
  }),

  valueContainer: (base) => ({
    ...base,
    padding: "2px 10px",
  }),

  singleValue: (base) => ({
    ...base,
    color: "#111827",
  }),

  indicatorSeparator: () => ({
    display: "none",
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "#6b7280",
    "&:hover": {
      color: "#111827",
    },
  }),
};