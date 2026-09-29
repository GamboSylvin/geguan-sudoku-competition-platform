import { useLocale } from "./i18n/locale-context";

/**
 * The placeholder page the frontend serves through the i18n scaffold (Unit 01,
 * Expected Behavior). It is deliberately featureless: it proves the app, the
 * router, Tailwind and the translation mechanism are wired together.
 */
export function PlaceholderPage() {
  const { t, locale, setLocale } = useLocale();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-800">
      <h1 className="text-3xl font-semibold">{t("placeholder.title")}</h1>
      <p className="text-slate-600">{t("placeholder.subtitle")}</p>
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      >
        {locale === "en" ? "中文" : "English"}
      </button>
    </main>
  );
}
