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
 * No visual polish beyond the existing panels' Tailwind defaults (UI-008).
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
    <section className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t("participant.title")}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDownloadSlips()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {t("participant.downloadSlips")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setAddOpen((open) => !open)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {t("participant.addOne")}
          </button>
        </div>
      </div>

      <form className="flex flex-col gap-2" onSubmit={onImport}>
        <p className="text-xs text-slate-600">{t("participant.importHint")}</p>
        <input
          type="file"
          accept=".xlsx"
          className="text-sm"
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
          className="self-start rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
        >
          {t("participant.importFile")}
        </button>
      </form>

      {imported && <p className="text-sm text-green-700">{imported}</p>}

      {failures && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
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
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
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
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm">
          <p className="font-medium">{t("participant.credentialsTitle")}</p>
          <p className="mt-1 text-xs text-slate-600">{t("participant.credentialsOnce")}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {credentials.map((credential) => (
              <li key={credential.participantId || credential.username}>
                #{credential.participantNumber} {credential.name} ({credential.schoolName} ·{" "}
                {credential.categoryName}) — <strong>{credential.username}</strong> /{" "}
                <code>{credential.password}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-700">{saved}</p>}

      {addOpen && (
        <form
          className="flex flex-col gap-2 rounded-md border border-slate-200 p-3"
          onSubmit={onAdd}
        >
          <p className="text-sm font-medium">{t("participant.addOne")}</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("participant.nameColumn")}
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("participant.schoolColumn")}
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                value={addSchool}
                onChange={(e) => setAddSchool(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("participant.categoryColumn")}
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
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
          <div className="flex flex-wrap gap-4 text-sm">
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
              className="rounded-md bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
            >
              {t("participant.save")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAddOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 disabled:opacity-60"
            >
              {t("participant.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium">{t("participant.roster")}</h4>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            {t("participant.showInactive")}
          </label>
        </div>

        {counts && (
          <p className="text-xs text-slate-600">
            {t("participant.totalCount")} {counts.total} · {t("participant.activeCount")}{" "}
            {counts.active} · {t("participant.individualEvent")} {counts.individualEvent} ·{" "}
            {t("participant.teamEvent")} {counts.teamEvent}
          </p>
        )}

        {participants.length === 0 ? (
          <p className="text-sm text-slate-600">{t("participant.rosterEmpty")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-1 pr-2">{t("participant.numberColumn")}</th>
                <th className="py-1 pr-2">{t("participant.nameColumn")}</th>
                <th className="py-1 pr-2">{t("participant.schoolColumn")}</th>
                <th className="py-1 pr-2">{t("participant.categoryColumn")}</th>
                <th className="py-1 pr-2">{t("participant.eventsColumn")}</th>
                <th className="py-1 pr-2">{t("participant.usernameColumn")}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <tr
                  key={participant.id}
                  className={`border-b border-slate-100 ${participant.active ? "" : "text-slate-400"}`}
                >
                  {editingId === participant.id ? (
                    <>
                      <td className="py-1 pr-2">{participant.participantNumber}</td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-32 rounded border border-slate-300 px-2 py-1"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className="w-32 rounded border border-slate-300 px-2 py-1"
                          value={editSchool}
                          onChange={(e) => setEditSchool(e.target.value)}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          className="rounded border border-slate-300 px-2 py-1"
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
                      <td className="py-1 pr-2">
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
                      <td className="py-1 pr-2">{participant.username ?? "—"}</td>
                      <td className="py-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy || !editName.trim()}
                            onClick={() => void onSaveEdit(participant.id)}
                            className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-60"
                          >
                            {t("participant.save")}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditingId(null)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                          >
                            {t("participant.cancel")}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1 pr-2">{participant.participantNumber}</td>
                      <td className="py-1 pr-2">{participant.name}</td>
                      <td className="py-1 pr-2">{participant.schoolName}</td>
                      <td className="py-1 pr-2">{categoryName(participant.categoryId)}</td>
                      <td className="py-1 pr-2">
                        {participant.individualEvent ? t("participant.individualShort") : ""}
                        {participant.individualEvent && participant.teamEvent ? " · " : ""}
                        {participant.teamEvent ? t("participant.teamShort") : ""}
                        {!participant.individualEvent && !participant.teamEvent ? "—" : ""}
                      </td>
                      <td className="py-1 pr-2">{participant.username ?? "—"}</td>
                      <td className="py-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openEdit(participant)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
                          >
                            {t("participant.editAction")}
                          </button>
                          {participant.active && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void onDeactivate(participant.id)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-60"
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
