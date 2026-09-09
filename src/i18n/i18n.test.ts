import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("i18n", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns the interpolated defaultValue verbatim before initAppI18n has resolved", async () => {
    const { t } = await import("./i18n.ts");
    expect(t("app.languageLabel", "Language")).toBe("Language");
    expect(
      t("roster.unavailable", "Unavailable: {{message}}", {
        message: "boom",
      }),
    ).toBe("Unavailable: boom");
  });

  it("leaves an unmatched {{var}} placeholder untouched before initAppI18n has resolved", async () => {
    const { t } = await import("./i18n.ts");
    expect(t("roster.unavailable", "Unavailable: {{message}}")).toBe(
      "Unavailable: {{message}}",
    );
  });

  it("initializes under this app's own namespace and translates a known key", async () => {
    const { initAppI18n, t } = await import("./i18n.ts");
    await initAppI18n();
    expect(t("app.languageLabel", "Language")).toBe("Language");
  });

  it("translates a key into French once the locale is switched", async () => {
    const { initAppI18n, t, getI18n } = await import("./i18n.ts");
    await initAppI18n();
    await getI18n()?.changeLanguage("fr");
    expect(t("app.languageLabel", "Language")).toBe("Langue");
  });

  it("uses this app's own storage key, not web-ui-kit's shared default", async () => {
    const { initAppI18n, STORAGE_KEY, getI18n } = await import("./i18n.ts");
    await initAppI18n();
    await getI18n()?.changeLanguage("fr");
    expect(STORAGE_KEY).toBe("mode-quick-versus-locale");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("fr");
    expect(window.localStorage.getItem("wuik-locale")).toBeNull();
  });

  it("falls back to the given defaultValue for a key missing from every catalog", async () => {
    const { initAppI18n, t } = await import("./i18n.ts");
    await initAppI18n();
    expect(t("nonexistent.key", "Fallback text")).toBe("Fallback text");
  });
});
