import { translate } from "../src/i18n";

/**
 * The i18n scaffold must be in place with English and Chinese as the only locales
 * (Unit 01, acceptance criterion 5). Both catalogues resolve, and an unknown key is
 * visible rather than silently empty.
 */
describe("i18n scaffold", () => {
  it("resolves a key in English and in Chinese", () => {
    expect(translate("en", "common.appName")).toBe("Sudoku Arena");
    expect(translate("zh", "common.appName")).toBe("数独竞技场");
  });

  it("returns the key itself when a translation is missing", () => {
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });
});
