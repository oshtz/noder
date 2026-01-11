export const toSafeWorkflowId = (input = "") => {
  const cleaned = input
    .split("")
    .map((ch) => (/[A-Za-z0-9 _-]/.test(ch) ? ch : "_"))
    .join("")
    .trim();

  return cleaned || "workflow";
};
