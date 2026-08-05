export const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    minWidth: 140,

    borderRadius: 12,
    boxShadow: "none",

    backgroundColor: "var(--color-surface)",
    borderColor: state.isFocused
      ? "var(--color-accent)"
      : "var(--color-border)",

    transition: "all .2s ease",

    "&:hover": {
      borderColor: "var(--color-accent)",
    },
  }),

  valueContainer: (base) => ({
    ...base,
    direction: "rtl",
    paddingInline: "12px",
  }),
  input: (base) => ({
    ...base,
    direction: "rtl",
    textAlign: "right",
    margin: 0,
  }),

  placeholder: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    direction: "rtl",
    textAlign: "right",
    margin: 0,
  }),

  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
    direction: "rtl",
    textAlign: "right",
    margin: 0,
  }),

  menu: (base) => ({
    ...base,
    zIndex: 9999,
    overflow: "hidden",

    borderRadius: 12,
    border: "1px solid var(--color-border)",

    backgroundColor: "var(--color-surface)",
  }),

  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),

  menuList: (base) => ({
    ...base,
    padding: 4,
  }),

  option: (base, state) => ({
    ...base,

    backgroundColor: state.isSelected
      ? "var(--color-accent)"
      : state.isFocused
        ? "rgba(220,151,80,.15)"
        : "transparent",

    color: state.isSelected ? "#fff" : "var(--color-text)",

    borderRadius: 8,
    cursor: "pointer",
  }),

  indicatorSeparator: () => ({
    display: "none",
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",

    "&:hover": {
      color: "var(--color-accent)",
    },
  }),

  clearIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",

    "&:hover": {
      color: "#ef4444",
    },
  }),
};
