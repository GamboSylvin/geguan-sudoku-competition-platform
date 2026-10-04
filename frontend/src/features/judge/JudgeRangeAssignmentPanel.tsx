import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-context";
import {
  assignJudgeRange,
  listJudges,
  unassignJudge,
  type JudgeSummaryView,
} from "../judge/judgeApi";

/**
 * The controller's range-assignment panel on the competition setup screen (Unit 06,
 * spec Implementation Details 6). Assigns a judge a participant-number range on this
 * competition, changeable at any time during the event (BLD-008 — no cutoff).
 *
 * Listing existing assignments is read through the competition's readiness state in
 * Unit 03; this panel only writes. The publish readiness check on the backend uses
 * the same CompetitionJudgeAssignment rows, so a saved range immediately counts
 * toward publish readiness.
 */
export function JudgeRangeAssignmentPanel({ competitionId }: { competitionId: string }) {
  const { t } = useLocale();

  const [judges, setJudges] = useState<JudgeSummaryView[]>([]);
  const [judgeId, setJudgeId] = useState("");
  const [from, setFrom] = useState<string>("1");
  const [to, setTo] = useState<string>("1");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listJudges()
      .then((result) => {
        if (!cancelled) setJudges(result.judges.filter((j) => j.active));
      })
      .catch(() => {
        if (!cancelled) setError(t("judge.genericError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onAssign(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!judgeId) return;
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const fromNumber = Number(from);
      const toNumber = Number(to);
      const assignment = await assignJudgeRange(competitionId, {
        judgeId,
        fromParticipantNumber: fromNumber,
        toParticipantNumber: toNumber,
      });
      setSaved(assignment.id);
    } catch {
      setError(t("judge.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onUnassign(assignmentId: string): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await unassignJudge(competitionId, assignmentId);
      setSaved(null);
    } catch {
      setError(t("judge.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium">{t("judge.assignTo")}</h3>

      <form className="flex flex-col gap-3" onSubmit={onAssign}>
        <label className="flex flex-col gap-1 text-sm">
          {t("judge.name")}
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={judgeId}
            onChange={(e) => setJudgeId(e.target.value)}
            required
          >
            <option value="">—</option>
            {judges.map((judge) => (
              <option key={judge.id} value={judge.id}>
                {judge.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t("judge.from")}
            <input
              type="number"
              min={1}
              className="w-24 rounded-md border border-slate-300 px-3 py-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("judge.to")}
            <input
              type="number"
              min={1}
              className="w-24 rounded-md border border-slate-300 px-3 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={busy || !judgeId}
          className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
        >
          {t("judge.saveAssignment")}
        </button>
      </form>

      {saved && (
        <p className="flex items-center gap-2 text-sm text-green-700">
          {t("competition.saved")}
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            onClick={() => onUnassign(saved)}
            disabled={busy}
          >
            {t("judge.unassign")}
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
