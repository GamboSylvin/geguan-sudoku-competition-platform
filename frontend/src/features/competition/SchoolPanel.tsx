import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-context";
import { CompetitionApiError } from "./competitionApi";
import {
  createSchool,
  deleteSchool,
  fetchSchools,
  referenceCountsFrom,
  renameSchool,
  type SchoolView,
} from "./schoolApi";

/**
 * The controller's schools panel on the setup screen (BLD-052).
 *
 * A school is setup data attached to the competition: list it, add one, rename it,
 * remove it. Nothing else is editable — `competitionId` comes from the URL and
 * `sequence` is derived at creation, so neither has a field here.
 *
 * The interaction that matters is removal. The server refuses a still-referenced
 * school (409 `school.hasParticipants` / `school.hasTeam`), and that refusal must be
 * **visible before the click**: the button is disabled and the reason shown beside
 * it, rather than a click that fails silently or a generic error message. The counts
 * come from the list itself, so no extra request is needed to decide the button's
 * state.
 *
 * Visuel : ambiance B « clair, sobre, cartes blanches » (BLD-054, révise U-66).
 * Même carte blanche que les autres panneaux de la page hôte ; le bouton « remove »
 * reprend la recette rouge des actions destructrices de l'ambiance B (comme dans
 * `JudgeManagementPage`) — un seul style par rôle visuel (§6/6). Les boutons
 * désactivés passent tous à `disabled:opacity-50`, la convention unique du rapport.
 */
export function SchoolPanel({ competitionId }: { competitionId: string }) {
  const { t } = useLocale();

  const [schools, setSchools] = useState<SchoolView[] | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** A translated backend code, falling back to the panel's generic message. */
  const messageFor = useCallback(
    (code: string): string => {
      const translated = t(code);
      return translated === code ? t("school.genericError") : translated;
    },
    [t],
  );

  const load = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      setSchools(await fetchSchools(competitionId));
      setError(null);
    } catch (err) {
      setError(
        err instanceof CompetitionApiError
          ? messageFor(err.code)
          : t("school.genericError"),
      );
    } finally {
      setBusy(false);
    }
  }, [competitionId, messageFor, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(event: FormEvent): Promise<void> {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await createSchool(competitionId, { name });
      setNewName("");
      setNotice(t("school.created"));
      await load();
    } catch (err) {
      setError(
        err instanceof CompetitionApiError
          ? messageFor(err.code)
          : t("school.genericError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRename(schoolId: string): Promise<void> {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await renameSchool(competitionId, schoolId, { name });
      setEditingId(null);
      setNotice(t("school.renamed"));
      await load();
    } catch (err) {
      setError(
        err instanceof CompetitionApiError
          ? messageFor(err.code)
          : t("school.genericError"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(schoolId: string): Promise<void> {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await deleteSchool(competitionId, schoolId);
      setNotice(t("school.removed"));
      await load();
    } catch (err) {
      // The button is already disabled whenever the guard would block this, so we only
      // land here if the state changed between render and click — hence reading the
      // counts the server returns rather than a plain fixed message.
      const counts = referenceCountsFrom(err);
      if (counts) {
        setError(
          counts.participants > 0
            ? t("school.blockedParticipants")
            : t("school.blockedTeam"),
        );
        await load();
      } else {
        setError(
          err instanceof CompetitionApiError
            ? messageFor(err.code)
            : t("school.genericError"),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow sm:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("school.title")}</h3>

      <form className="flex gap-2" onSubmit={onAdd}>
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
          aria-label={t("school.addLabel")}
          placeholder={t("school.addPlaceholder")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {t("school.add")}
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700 sm:text-sm">
          {notice}
        </p>
      )}

      {schools === null ? (
        <p className="text-xs text-gray-500 sm:text-sm">{t("common.loading")}</p>
      ) : schools.length === 0 ? (
        <p className="text-xs text-gray-500 sm:text-sm">{t("school.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {schools.map((school) => {
            const blocked = school.participantCount > 0 || school.teamCount > 0;
            const reason =
              school.participantCount > 0
                ? t("school.blockedParticipants")
                : t("school.blockedTeam");
            return (
              <li
                key={school.id}
                className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 text-xs text-gray-700 sm:text-sm"
              >
                {editingId === school.id ? (
                  <>
                    <input
                      className="w-48 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                      aria-label={t("school.nameLabel")}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busy || !editName.trim()}
                      onClick={() => void onSaveRename(school.id)}
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("school.save")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("school.cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-48 font-medium text-gray-900">{school.name}</span>
                    <span className="text-xs tabular-nums text-gray-500">
                      {school.participantCount} {t("school.participantsCount")} ·{" "}
                      {school.teamCount} {t("school.teamsCount")}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(school.id);
                        setEditName(school.name);
                        setNotice(null);
                        setError(null);
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("school.rename")}
                    </button>
                    <button
                      type="button"
                      disabled={busy || blocked}
                      onClick={() => void onRemove(school.id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("school.remove")}
                    </button>
                    {blocked && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{reason}</span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
