import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../../i18n/locale-context";
import {
  assignJudgeRange,
  listCompetitionAssignments,
  listJudges,
  unassignJudge,
  type CompetitionJudgeAssignmentView,
  type JudgeSummaryView,
} from "../judge/judgeApi";

/**
 * The controller's range-assignment panel on the competition setup screen (Unit 06,
 * spec Implementation Details 6). Assigns a judge a participant-number range on this
 * competition, changeable at any time during the event (BLD-008 — no cutoff).
 *
 * The publish readiness check on the backend uses the same `CompetitionJudgeAssignment`
 * rows, so a saved range immediately counts toward publish readiness.
 *
 * **Report 2026-10-19, §4b/§4c:** this panel used to be write-only ("From"/"To" with no
 * explanation, and no way to see a range already saved by someone else), so assigning a
 * second judge meant working blind. It now reads `GET …/judge-assignments` and shows
 * every recorded range, with explicit labels and a help line, plus a link to where a
 * judge is actually created (`/controller/judges`) — nothing on this screen said that
 * before either. Overlap between two judges' ranges is shown, not prevented or flagged:
 * whether that should be allowed is still open (I-43).
 *
 * Visual: mood B, "light, sober, white cards" (BLD-054, revising U-66).
 * A white card exactly identical to that of the other panels of the host page
 * (`CompetitionSetupPage`): one single style per visual role (§6/6). The number
 * ranges carry `tabular-nums` — these are aligned figures (§3.5).
 */
export function JudgeRangeAssignmentPanel({ competitionId }: { competitionId: string }) {
  const { t } = useLocale();

  const [judges, setJudges] = useState<JudgeSummaryView[]>([]);
  const [assignments, setAssignments] = useState<CompetitionJudgeAssignmentView[] | null>(null);
  const [judgeId, setJudgeId] = useState("");
  const [from, setFrom] = useState<string>("1");
  const [to, setTo] = useState<string>("1");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAssignments = useCallback(async (): Promise<void> => {
    try {
      const result = await listCompetitionAssignments(competitionId);
      setAssignments(result.assignments);
    } catch {
      setError(t("judge.genericError"));
    }
  }, [competitionId, t]);

  useEffect(() => {
    let cancelled = false;
    listJudges()
      .then((result) => {
        if (!cancelled) setJudges(result.judges.filter((j) => j.active));
      })
      .catch(() => {
        if (!cancelled) setError(t("judge.genericError"));
      });
    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [t, loadAssignments]);

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
      await loadAssignments();
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
      setSaved((current) => (current === assignmentId ? null : current));
      await loadAssignments();
    } catch {
      setError(t("judge.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("judge.assignTo")}</h3>
        <Link
          to="/controller/judges"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-500 sm:text-sm"
        >
          {t("judge.createJudgeLink")}
        </Link>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onAssign}>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
          {t("judge.name")}
          <select
            className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
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

        <p className="text-xs text-gray-500 sm:text-sm">{t("judge.rangeHelp")}</p>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
            {t("judge.fromParticipantNumber")}
            <input
              type="number"
              min={1}
              className="w-24 rounded border border-gray-300 px-3 py-2 text-xs tabular-nums text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
            {t("judge.toParticipantNumber")}
            <input
              type="number"
              min={1}
              className="w-24 rounded border border-gray-300 px-3 py-2 text-xs tabular-nums text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={busy || !judgeId}
          className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {t("judge.saveAssignment")}
        </button>
      </form>

      {saved && (
        <p className="flex items-center gap-2 text-xs font-medium text-green-700 sm:text-sm">
          {t("competition.saved")}
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onUnassign(saved)}
            disabled={busy}
          >
            {t("judge.unassign")}
          </button>
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
          {t("judge.existingRanges")}
        </h4>
        {assignments === null ? null : assignments.length === 0 ? (
          <p className="text-xs text-gray-500 sm:text-sm">{t("judge.noRanges")}</p>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-gray-200 text-xs font-semibold text-gray-500">
              <tr>
                <th className="py-2 pr-2 text-left font-semibold">{t("judge.columnJudge")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("judge.columnRange")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("judge.columnRecordedBy")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("judge.columnRecordedAt")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-b border-gray-100 text-gray-700">
                  <td className="py-2 pr-2">
                    {assignment.judgeName}
                    {!assignment.judgeActive && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({t("judge.judgeInactiveHint")})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">
                    #{assignment.fromParticipantNumber}–#{assignment.toParticipantNumber}
                  </td>
                  <td className="py-2 pr-2">{assignment.assignedByUsername ?? "—"}</td>
                  <td className="py-2 pr-2">{new Date(assignment.assignedAt).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onUnassign(assignment.id)}
                      disabled={busy}
                    >
                      {t("judge.unassign")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
