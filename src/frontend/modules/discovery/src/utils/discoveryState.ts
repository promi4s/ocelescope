import type { DiscoverySchema } from "../types";

export const getInitialFormData = (schema: DiscoverySchema | undefined) => {
  const initial: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema?.properties ?? {})) {
    if (property.default !== undefined) {
      initial[name] = property.default;
      continue;
    }
    if (property.type === "array") initial[name] = [];
  }
  return initial;
};

export const normalizeFormData = (formData: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(formData).filter(([_, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
