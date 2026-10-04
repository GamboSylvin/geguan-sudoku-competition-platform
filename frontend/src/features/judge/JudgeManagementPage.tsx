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
 * Functional and minimally styled — the finished visual design is deferred (U-66).
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-slate-50 p-6 text-slate-800">
      <h1 className="text-2xl font-semibold">{t("judge.title")}</h1>

      <form className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4" onSubmit={onCreate}>
        <label className="flex flex-col gap-1 text-sm">
          {t("judge.name")}
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
        >
          {t("judge.create")}
        </button>
      </form>

      {created && (
        <section className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">{t("judge.created")}</p>
          <p>
            <span className="font-medium">{t("judge.username")}:</span>{" "}
            <code className="rounded bg-white px-1 py-0.5">{created.username}</code>
          </p>
          <p>
            <span className="font-medium">{t("judge.password")}:</span>{" "}
            <code className="rounded bg-white px-1 py-0.5">{created.password}</code>
          </p>
          <p className="text-amber-800">{t("judge.credentialNote")}</p>
        </section>
      )}

      {blockedBy && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
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
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{t("judge.list")}</h2>
        {!judges ? (
          <p className="text-sm text-slate-600">{t("common.loading")}</p>
        ) : judges.length === 0 ? (
          <p className="text-sm text-slate-600">—</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {judges.map((judge) => (
              <li
                key={judge.id}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span>
                  {judge.name}{" "}
                  <span className="text-xs text-slate-500">
                    ({judge.active ? t("judge.active") : t("judge.inactive")})
                  </span>
                </span>
                {judge.active && (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-60"
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
