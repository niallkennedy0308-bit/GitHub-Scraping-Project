export const THEME_STORAGE_KEY = "admin-color-theme";

export type ThemeId = "harbor" | "obsidian" | "velvet" | "copper" | "mist";

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
  /** Preview swatches: background, surface, accent */
  swatches: [string, string, string];
};

export const THEMES: ThemeDefinition[] = [
  {
    id: "harbor",
    label: "Midnight Harbor",
    description: "Deep navy with polished teal accents.",
    swatches: ["#0b1524", "#15233a", "#2dd4bf"],
  },
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Near-black graphite with cool steel highlights.",
    swatches: ["#0a0b0d", "#171a1f", "#94a3b8"],
  },
  {
    id: "velvet",
    label: "Velvet Noir",
    description: "Oxblood and ink with warm champagne accents.",
    swatches: ["#140c10", "#24151c", "#d4a574"],
  },
  {
    id: "copper",
    label: "Copper Forge",
    description: "Charcoal base with refined copper warmth.",
    swatches: ["#12100e", "#221c18", "#d97706"],
  },
  {
    id: "mist",
    label: "Alpine Mist",
    description: "Soft blue-gray light theme for daytime work.",
    swatches: ["#e8eef5", "#ffffff", "#0f766e"],
  },
];

export const DEFAULT_THEME: ThemeId = "harbor";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}
