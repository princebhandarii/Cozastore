export const RETURN_REASONS = [
  { value: "DAMAGED", label: "Damaged" },
  { value: "DEFECTIVE", label: "Defective" },
  { value: "WRONG_PRODUCT", label: "Wrong product" },
  { value: "SIZE_ISSUE", label: "Size issue" },
  { value: "NOT_AS_EXPECTED", label: "Not as expected" },
  { value: "OTHER", label: "Other" },
];
export const reasonLabel = (v) => RETURN_REASONS.find((r) => r.value === v)?.label || v;
