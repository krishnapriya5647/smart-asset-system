export type ThemeMode = "light" | "dark";

const KEY = "ui_theme_mode";

export const themeStore = {
  get(): ThemeMode {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "dark";
  },
  set(mode: ThemeMode) {
    localStorage.setItem(KEY, mode);
    window.dispatchEvent(new Event("theme_mode_changed"));
  },
};
