import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-context";
import {
  blockingCompetitionsFrom,
  createJudge,
  listJudges,
  removeJudge,
  type CreatedJudgeView,
  type JudgeSummaryView,
} from "./judgeApi";

/**
 * The controller's judge-management screen (Unit 06): create a judge, see the
 * one-time credentials for the slip export, list every judge, remove a judge (with
 * the ROL-010 removal-guard error naming the blocking competition).
 *
 * Visual: mood B, "light, sober, white cards" (BLD-054, revising U-66).
 * Recipe: RAPPORT-CSS-sudoku_arena.md §4.B, mapping in context/ui-context.md,
 * "Visual design system".
 */
export function JudgeManagementPage() {
  const { t } = useLocale();

  const [judges, setJudges] = useState<JudgeSummaryView[] | null>(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedJudgeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listJudges()
      .then((result) => {
        if (!cancelled) setJudges(result.judges);
      })
      .catch(() => {
        if (!cancelled) setError(t("judge.genericError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function refresh(): Promise<void> {
    try {
      const result = await listJudges();
      setJudges(result.judges);
    } catch {
      setError(t("judge.genericError"));
    }
  }

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBlockedBy(null);
    setBusy(true);
    try {
      const judge = await createJudge({ name: name.trim() });
      setCreated(judge);
      setName("");
      await refresh();
    } catch {
      setError(t("judge.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string): Promise<void> {
    setError(null);
    setBlockedBy(null);
    setBusy(true);
    try {
      await removeJudge(id);
      await refresh();
    } catch (err) {
      const names = blockingCompetitionsFrom(err);
      if (names) {
        setBlockedBy(names);
      } else {
        setError(t("judge.genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-gray-50 p-4 text-gray-900 sm:p-6">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{t("judge.title")}</h1>

      <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow sm:p-6" onSubmit={onCreate}>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
          {t("judge.name")}
          <input
            className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {t("judge.create")}
        </button>
      </form>

      {created && (
        <section className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:p-6 sm:text-sm">
          <p className="font-medium text-amber-900">{t("judge.created")}</p>
          <p className="text-gray-700">
            <span className="font-medium">{t("judge.username")}:</span>{" "}
            <code className="rounded bg-white px-1 font-mono text-gray-900">{created.username}</code>
          </p>
          <p className="text-gray-700">
            <span className="font-medium">{t("judge.password")}:</span>{" "}
            <code className="rounded bg-white px-1 font-mono text-gray-900">{created.password}</code>
          </p>
          <p className="text-amber-800">{t("judge.credentialNote")}</p>
        </section>
      )}

      {blockedBy && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 sm:text-sm"
        >
          <p className="font-medium">{t("judge.blocked")}</p>
          <ul className="mt-1 list-disc pl-5">
            {blockedBy.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("judge.list")}</h2>
        {!judges ? (
          <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
        ) : judges.length === 0 ? (
          <p className="text-xs text-gray-500 sm:text-sm">—</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {judges.map((judge) => (
              <li
                key={judge.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs shadow transition-colors hover:border-gray-300 hover:shadow-sm sm:text-sm"
              >
                <span className="font-medium text-gray-900">
                  {judge.name}{" "}
                  <span className="text-xs text-gray-500">
                    ({judge.active ? t("judge.active") : t("judge.inactive")})
                  </span>
                </span>
                {judge.active && (
                  <button
                    type="button"
                    className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    onClick={() => onRemove(judge.id)}
                    disabled={busy}
                  >
                    {t("judge.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
