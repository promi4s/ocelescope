import type { DiscoverySchema, PanelState, StoredSettings } from "../types";

export const PANEL_MIN = 240;
export const PANEL_MAX = 600;
export const PANEL_DEFAULT = 320;
export const PANEL_KEY = "ocelescope:discovery:panel";

export const getSettingsKey = (ocelId: string) =>
  `ocelescope:discovery:settings:${ocelId}`;

export const loadPanelState = (): PanelState => {
  try {
    const stored = localStorage.getItem(PANEL_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PanelState>;
      return {
        width: parsed.width ?? PANEL_DEFAULT,
        collapsed: parsed.collapsed ?? false,
      };
    }
  } catch {}
  return { width: PANEL_DEFAULT, collapsed: false };
};

export const loadStoredSettings = (ocelId: string): StoredSettings => {
  try {
    const stored = localStorage.getItem(getSettingsKey(ocelId));
    if (stored) return JSON.parse(stored) as StoredSettings;
  } catch {}
  return {};
};

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
