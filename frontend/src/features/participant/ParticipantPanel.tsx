import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-context";
import {
  addParticipant,
  deactivateParticipant,
  downloadCredentials,
  editParticipant,
  fetchParticipants,
  importFailuresFrom,
  importParticipantFile,
  ParticipantApiError,
  type ImportFailureView,
  type ImportWarningView,
  type IssuedCredentialView,
  type ParticipantListView,
  type ParticipantView,
} from "./participantApi";

/**
 * The controller's participant panel on the competition setup screen (Unit 04).
 *
 * It is the roster half of the same import story the question panel is: upload one
 * `.xlsx`, get either a committed batch with freshly issued credentials or a row-level
 * rejection list. Everything below the upload is the roster that import produced, plus
 * the three single-row actions the spec allows once a competition is published
 * (add / edit / deactivate) and the printable credential slips.
 *
 * **No team formation is offered here.** Team building is deferred out of Unit 04 (spec
 * §8 Q10, U-102) — the `团队赛` flag is stored and counted so a later unit has the data,
 * but `teamId` stays null and nothing on this panel assigns a team. The counts line shows
 * how many students flagged the team event, per the file's own rule: `1` = taking part,
 * blank or `2` = not.
 *
 * Credentials are shown **once**, immediately after the call that issued them: the
 * plaintext password is never stored, so closing this panel is the end of the only
 * on-screen chance to read it. The slips download is the retrieval path afterwards.
 *
 * Visuel : ambiance B « clair, sobre, cartes blanches » (BLD-054, révise U-66).
 * Même carte blanche que les autres panneaux de la page hôte (`CompetitionSetupPage`) —
 * un seul style par rôle visuel (§6/6). Le bloc des identifiants émis reprend la recette
 * ambre de `JudgeManagementPage`, parce que c'est le même rôle visuel : une information
 * à lire une seule fois. Numéros d'élève et compteurs portent `tabular-nums`, les
 * identifiants `font-mono` (§3.5). Tous les boutons désactivés passent à
 * `disabled:opacity-50`, la convention unique du rapport.
 */
export interface ParticipantPanelCategory {
  id: string;
  name: string;
}

export function ParticipantPanel({
  competitionId,
  categories,
}: {
  competitionId: string;
  categories: ParticipantPanelCategory[];
}) {
  const { t } = useLocale();

  /**
   * Turn a backend error code into the controller's own language. `translate` returns the
   * key itself when a catalogue has no entry, so an unmapped code falls back to the
   * generic message rather than showing a raw dot-path on screen.
   */
  const messageFor = useCallback(
    (code: string): string => {
      if (code === "VALIDATION_ERROR") return t("common.validationFailed");
      const translated = t(code);
      return translated === code ? t("participant.genericError") : translated;
    },
    [t],
  );

  const [roster, setRoster] = useState<ParticipantListView | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [failures, setFailures] = useState<ImportFailureView[] | null>(null);
  const [warnings, setWarnings] = useState<ImportWarningView[] | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentialView[] | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // The add form. Both flags default to "not taking part", matching a blank cell.
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSchool, setAddSchool] = useState("");
  const [addCategory, setAddCategory] = useState(categories[0]?.id ?? "");
  const [addIndividual, setAddIndividual] = useState(false);
  const [addTeam, setAddTeam] = useState(false);

  // The inline edit form: at most one row is open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editIndividual, setEditIndividual] = useState(false);
  const [editTeam, setEditTeam] = useState(false);

  const loadRoster = useCallback(
    async (inactive: boolean): Promise<void> => {
      setBusy(true);
      try {
        // `active: false` would list *only* the deactivated rows; leaving the filter off
        // lists every row, which is what "show inactive" means on this screen.
        setRoster(await fetchParticipants(competitionId, inactive ? {} : { active: true }));
      } catch (err) {
        setError(err instanceof ParticipantApiError ? messageFor(err.code) : t("participant.genericError"));
      } finally {
        setBusy(false);
      }
    },
    [competitionId, messageFor, t],
  );

  useEffect(() => {
    void loadRoster(showInactive);
  }, [loadRoster, showInactive]);

  function categoryName(id: string): string {
    return categories.find((category) => category.id === id)?.name ?? id;
  }

  async function onImport(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file) return;
    setError(null);
    setFailures(null);
    setWarnings(null);
    setCredentials(null);
    setImported(null);
    setBusy(true);
    try {
      const result = await importParticipantFile(competitionId, file);
      setFile(null);
      setWarnings(result.warnings.length > 0 ? result.warnings : null);
      setCredentials(result.credentials.length > 0 ? result.credentials : null);
      setImported(
        `${t("participant.imported")} · ${t("participant.createdCount")} ${result.created} · ` +
          `${t("participant.keptCount")} ${result.kept} · ${t("participant.deactivatedCount")} ${result.deactivated}`,
      );
      await loadRoster(showInactive);
    } catch (err) {
      const rows = importFailuresFrom(err);
      if (rows) {
        setFailures(rows);
      } else if (err instanceof ParticipantApiError) {
        setError(messageFor(err.code));
      } else {
        setError(t("participant.genericError"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!addName.trim() || !addCategory) return;
    setError(null);
    setSaved(null);
    setCredentials(null);
    setBusy(true);
    try {
      const result = await addParticipant(competitionId, {
        name: addName.trim(),
        categoryId: addCategory,
        schoolName: addSchool.trim(),
        individualEvent: addIndividual,
        teamEvent: addTeam,
      });
      if (result.credential) setCredentials([result.credential]);
      setSaved(t("participant.addedNotice"));
      setAddName("");
      setAddSchool("");
      setAddIndividual(false);
      setAddTeam(false);
      setAddOpen(false);
      await loadRoster(showInactive);
    } catch (err) {
      setError(err instanceof ParticipantApiError ? messageFor(err.code) : t("participant.genericError"));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(participant: ParticipantView): void {
    setSaved(null);
    setError(null);
    setEditingId(participant.id);
    setEditName(participant.name);
    setEditSchool(participant.schoolName);
    setEditCategory(participant.categoryId);
    setEditIndividual(participant.individualEvent);
    setEditTeam(participant.teamEvent);
  }

  async function onSaveEdit(participantId: string): Promise<void> {
    if (!editName.trim()) return;
    setError(null);
    setSaved(null);
    setCredentials(null);
    setBusy(true);
    try {
      const result = await editParticipant(competitionId, participantId, {
        name: editName.trim(),
        categoryId: editCategory,
        schoolName: editSchool.trim(),
        individualEvent: editIndividual,
        teamEvent: editTeam,
      });
      // A name change replaces the student and mints a new login; show it once.
      if (result.credential) setCredentials([result.credential]);
      setSaved(t("participant.edited"));
      setEditingId(null);
      await loadRoster(showInactive);
    } catch (err) {
      setError(err instanceof ParticipantApiError ? messageFor(err.code) : t("participant.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(participantId: string): Promise<void> {
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      await deactivateParticipant(competitionId, participantId);
      setSaved(t("participant.deactivated"));
      await loadRoster(showInactive);
    } catch (err) {
      setError(err instanceof ParticipantApiError ? messageFor(err.code) : t("participant.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadSlips(): Promise<void> {
    setError(null);
    setSaved(null);
    setBusy(true);
    try {
      const fileName = await downloadCredentials(competitionId);
      setSaved(`${t("participant.slipsDownloaded")} · ${fileName}`);
    } catch (err) {
      setError(err instanceof ParticipantApiError ? messageFor(err.code) : t("participant.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const participants = roster?.participants ?? [];
  const counts = roster?.counts;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("participant.title")}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDownloadSlips()}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            {t("participant.downloadSlips")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setAddOpen((open) => !open)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            {t("participant.addOne")}
          </button>
        </div>
      </div>

      <form className="flex flex-col gap-2" onSubmit={onImport}>
        <p className="text-xs text-gray-500 sm:text-sm">{t("participant.importHint")}</p>
        <input
          type="file"
          accept=".xlsx"
          className="text-xs text-gray-700 sm:text-sm"
          aria-label={t("participant.chooseFile")}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setImported(null);
            setFailures(null);
            setWarnings(null);
            setCredentials(null);
          }}
        />
        <button
          type="submit"
          disabled={busy || !file}
          className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {t("participant.importFile")}
        </button>
      </form>

      {imported && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700 sm:text-sm">
          {imported}
        </p>
      )}

      {failures && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:text-sm"
        >
          <p className="font-medium">{t("participant.rejected")}</p>
          <ul className="mt-1 list-disc pl-5">
            {failures.map((failure, index) => (
              <li key={`${failure.row}-${failure.code}-${index}`}>
                {t("participant.row")} {failure.row}
                {failure.column ? ` · ${failure.column}` : ""} — {t(failure.code)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:text-sm">
          <ul className="list-disc pl-5">
            {warnings.map((warning, index) => (
              <li key={`${warning.row}-${warning.code}-${index}`}>
                {t("participant.row")} {warning.row} — {t(warning.code)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {credentials && credentials.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
          <p className="font-medium">{t("participant.credentialsTitle")}</p>
          <p className="mt-1 text-xs text-amber-800">{t("participant.credentialsOnce")}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {credentials.map((credential) => (
              <li key={credential.participantId || credential.username}>
                #{credential.participantNumber} {credential.name} ({credential.schoolName} ·{" "}
                {credential.categoryName}) — <strong>{credential.username}</strong> /{" "}
                <code className="rounded bg-white px-1 font-mono text-gray-900">{credential.password}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 sm:text-sm">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs font-medium text-green-700 sm:text-sm">
          {saved}
        </p>
      )}

      {addOpen && (
        <form
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
          onSubmit={onAdd}
        >
          <p className="text-xs font-semibold text-gray-900 sm:text-sm">{t("participant.addOne")}</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
              {t("participant.nameColumn")}
              <input
                className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
              {t("participant.schoolColumn")}
              <input
                className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                value={addSchool}
                onChange={(e) => setAddSchool(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 sm:text-sm">
              {t("participant.categoryColumn")}
              <select
                className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:text-sm"
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-700 sm:text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addIndividual}
                onChange={(e) => setAddIndividual(e.target.checked)}
              />
              {t("participant.individualEvent")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addTeam}
                onChange={(e) => setAddTeam(e.target.checked)}
              />
              {t("participant.teamEvent")}
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !addName.trim() || !addCategory}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {t("participant.save")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAddOpen(false)}
              className="rounded border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {t("participant.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">{t("participant.roster")}</h4>
          <label className="flex items-center gap-2 text-xs text-gray-500 sm:text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            {t("participant.showInactive")}
          </label>
        </div>

        {counts && (
          <p className="text-xs tabular-nums text-gray-500">
            {t("participant.totalCount")} {counts.total} · {t("participant.activeCount")}{" "}
            {counts.active} · {t("participant.individualEvent")} {counts.individualEvent} ·{" "}
            {t("participant.teamEvent")} {counts.teamEvent}
          </p>
        )}

        {participants.length === 0 ? (
          <p className="text-xs text-gray-500 sm:text-sm">{t("participant.rosterEmpty")}</p>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-gray-200 text-xs font-semibold text-gray-500">
              <tr>
                <th className="py-2 pr-2 text-left font-semibold">{t("participant.numberColumn")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("participant.nameColumn")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("participant.schoolColumn")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("participant.categoryColumn")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("participant.eventsColumn")}</th>
                <th className="py-2 pr-2 text-left font-semibold">{t("participant.usernameColumn")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr
                  key={participant.id}
                  className={`border-b border-gray-100 text-gray-700 transition-colors hover:bg-gray-50 ${participant.active ? "" : "text-gray-400"}`}
                >
                  {editingId === participant.id ? (
                    <>
                      <td className="py-2 pr-2 tabular-nums">{participant.participantNumber}</td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={editSchool}
                          onChange={(e) => setEditSchool(e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <label className="mr-2 inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={editIndividual}
                            onChange={(e) => setEditIndividual(e.target.checked)}
                          />
                          {t("participant.individualShort")}
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={editTeam}
                            onChange={(e) => setEditTeam(e.target.checked)}
                          />
                          {t("participant.teamShort")}
                        </label>
                      </td>
                      <td className="py-2 pr-2 font-mono">{participant.username ?? "—"}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy || !editName.trim()}
                            onClick={() => void onSaveEdit(participant.id)}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t("participant.save")}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditingId(null)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t("participant.cancel")}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-2 tabular-nums">{participant.participantNumber}</td>
                      <td className="py-2 pr-2">{participant.name}</td>
                      <td className="py-2 pr-2">{participant.schoolName}</td>
                      <td className="py-2 pr-2">{categoryName(participant.categoryId)}</td>
                      <td className="py-2 pr-2">
                        {participant.individualEvent ? t("participant.individualShort") : ""}
                        {participant.individualEvent && participant.teamEvent ? " · " : ""}
                        {participant.teamEvent ? t("participant.teamShort") : ""}
                        {!participant.individualEvent && !participant.teamEvent ? "—" : ""}
                      </td>
                      <td className="py-2 pr-2 font-mono">{participant.username ?? "—"}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openEdit(participant)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t("participant.editAction")}
                          </button>
                          {participant.active && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onDeactivate(participant.id)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t("participant.deactivate")}
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
