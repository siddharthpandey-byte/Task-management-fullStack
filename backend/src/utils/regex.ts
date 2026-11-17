// escape user input before using it in a $regex (prevents ReDoS / regex injection)
export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
