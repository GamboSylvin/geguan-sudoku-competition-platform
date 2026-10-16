import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";
import {
  FIXTURE_HEADERS,
  buildParticipantWorkbook,
  buildUploadBody,
  noteRow,
  validRow,
} from "./participant-fixture";
import type { FixtureRow } from "./participant-fixture";

/**
 * Unit 04 integration tests: importing one competition's participant workbook.
 *
 * This file locks in the **already decided** rules of `participant-parse.ts`
 * (V1-V8, PAR-010/011/012, the `1` / `2` / blank flag of cell L2) and the behaviour
 * of `participant.service.ts` as it is built — it invents none of them. No real
 * populated file exists: the rows come from `participant-fixture.ts`, which builds a
 * real `.xlsx` workbook by hand, the same way `question-fixture.ts` does for Unit 05.
 *
 * Covered: resolving `组别` by name **or** by code, the three valid values of each
 * flag plus one invalid one, the equivalence between a numeric cell and a shared
 * string, the deliberately ignored columns, the V5 duplicates, the V8 warning that
 * does not reject, the skipped note row, the two V2 cases, the re-import that updates
 * in place (Finding 10), the V1 missing column, and the same access guard as Unit 05's
 * tests (controller only, plus PAR-009's 409 after publication).
 *
 * Not covered here: how the screens look (UI-008), and team formation — the unit
 * writes no `Team` row (spec §8 Q10, U-102).
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it4-controller-${suffix}`,
  judge: `it4-judge-${suffix}`,
};

const createdCompetitionIds: string[] = [];
let controllerToken = "";
let controllerDevice = "";
let judgeToken = "";
let judgeDevice = "";

async function createAccount(
  username: string,
  role: "CONTROLLER" | "JUDGE",
): Promise<void> {
  await prisma.account.create({
    data: {
      username,
      role,
      isActive: true,
      passwordHash: await identityService.hashPassword(PASSWORD),
    },
  });
}

function login(role: "controller" | "judge", username: string) {
  return request(app)
    .post(`/api/auth/${role}/login`)
    .set("x-device-id", `device-${Math.random().toString(36).slice(2)}`)
    .send({ username, password: PASSWORD });
}

/**
 * A competition with two groups: one is written in the file by its **name**, the
 * other by its **code**, and both must resolve to the right `CompetitionCategory`
 * (V4). The names are those of the real group scheme (BLD-041).
 */
async function makeCompetition(name: string) {
  const competition = await competitionService.createCompetition({
    name,
    categories: [
      { code: "U8", name: "一二年级组" },
      { code: "U10", name: "三四年级组" },
    ],
  });
  createdCompetitionIds.push(competition.id);
  return {
    id: competition.id,
    byName: competition.categories.find((c) => c.name === "一二年级组")!,
    byCode: competition.categories.find((c) => c.name === "三四年级组")!,
  };
}

function authed(req: request.Test): request.Test {
  return req.set("x-session-token", controllerToken).set("x-device-id", controllerDevice);
}

function importUrl(competitionId: string): string {
  return `/api/competitions/${competitionId}/participants/import`;
}

/** POST un classeur comme la partie fichier `multipart` que l'endpoint attend. */
function upload(competitionId: string, rows: FixtureRow[], headers?: readonly string[]) {
  const workbook = buildParticipantWorkbook(rows, headers);
  const { body, boundary } = buildUploadBody(workbook);
  return authed(request(app).post(importUrl(competitionId)))
    .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
    .send(body);
}

interface Credential {
  participantId: string;
  participantNumber: number;
  name: string;
  username: string;
  password: string;
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  // A judge proves the module — the one that mints the players' identifiers —
  // stays refused to every other role (ROL-002).
  await createAccount(users.judge, "JUDGE");
  const judge = await login("judge", users.judge);
  judgeToken = judge.body.token;
  judgeDevice = judge.body.deviceId;
});

afterAll(async () => {
  // The `PLAYER` accounts created by this file's imports, before the
  // competitions: the filter goes through the participant, so it must still
  // exist. Never a global filter on the username — the database is shared
  // between suites.
  await prisma.account.deleteMany({
    where: { participant: { competitionId: { in: createdCompetitionIds } } },
  });
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

describe("a valid file imports (AC 1)", () => {
  it("creates the school, the participants and one credential each, numbering them itself", async () => {
    const ctx = await makeCompetition(`Valid ${suffix}`);
    const res = await upload(ctx.id, [
      validRow({ 姓名: "张三" }),
      validRow({ 姓名: "李四", 学校名称: "文澜小学", 组别: "U10", 个人赛: null, 团队赛: "1" }),
    ]);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMMITTED");
    expect(res.body.created).toBe(2);
    expect(res.body.kept).toBe(0);
    expect(res.body.replaced).toBe(0);
    expect(res.body.deactivated).toBe(0);
    expect(res.body.warnings).toEqual([]);

    const credentials = res.body.credentials as Credential[];
    expect(credentials).toHaveLength(2);
    // Un mot de passe en clair n'existe qu'ici, une seule fois (spec §4.4 step 4).
    for (const credential of credentials) {
      expect(credential.password.length).toBeGreaterThan(0);
      expect(credential.participantId.length).toBeGreaterThan(0);
    }

    const list = await authed(request(app).get(`/api/competitions/${ctx.id}/participants`));
    expect(list.status).toBe(200);
    const participants = list.body.participants as {
      participantNumber: number;
      name: string;
      schoolName: string;
      individualEvent: boolean;
      teamEvent: boolean;
      username: string | null;
      teamId: string | null;
    }[];
    expect(participants).toHaveLength(2);
    // PAR-012: the number comes from the system, never from the `选手编号` column
    // (901 in the fixture), and it follows the file's order.
    expect(participants.map((p) => p.participantNumber)).toEqual([1, 2]);
    expect(participants[0]!.username).toBe(credentials[0]!.username);
    expect(participants[0]!.individualEvent).toBe(true);
    expect(participants[0]!.teamEvent).toBe(false);
    expect(participants[1]!.individualEvent).toBe(false);
    expect(participants[1]!.teamEvent).toBe(true);
    // No team is created by this unit (spec §8 Q10).
    expect(participants.every((p) => p.teamId === null)).toBe(true);

    // An active `PLAYER` account exists behind each rendered identifier.
    const account = await prisma.account.findUniqueOrThrow({
      where: { username: credentials[0]!.username },
    });
    expect(account.role).toBe("PLAYER");
    expect(account.isActive).toBe(true);
    expect(account.participantId).toBe(credentials[0]!.participantId);
    // The password is hashed, never stored in clear.
    expect(account.passwordHash).not.toBe(credentials[0]!.password);
  });

  it("resolves 组别 by category name and by category code to the same categories (V4)", async () => {
    const ctx = await makeCompetition(`Category ${suffix}`);
    const res = await upload(ctx.id, [
      validRow({ 姓名: "按名字", 组别: "一二年级组" }),
      validRow({ 姓名: "按代码", 组别: "U10" }),
    ]);
    expect(res.status).toBe(200);

    const list = await authed(request(app).get(`/api/competitions/${ctx.id}/participants`));
    const byName = (list.body.participants as { name: string; categoryId: string }[]).find(
      (p) => p.name === "按名字",
    )!;
    const byCode = (list.body.participants as { name: string; categoryId: string }[]).find(
      (p) => p.name === "按代码",
    )!;
    expect(byName.categoryId).toBe(ctx.byName.id);
    expect(byCode.categoryId).toBe(ctx.byCode.id);
  });

  it("rejects a 组别 that matches neither a name nor a code, naming the row (V4)", async () => {
    const ctx = await makeCompetition(`Unknown category ${suffix}`);
    const res = await upload(ctx.id, [
      validRow({ 姓名: "张三" }),
      validRow({ 姓名: "李四", 组别: "六年级组" }),
    ]);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("participant.import.unknownCategory");
    const failures = res.body.error.details.failures as { row: number; column?: string }[];
    // Excel's row 3: the header is row 1, `张三` row 2.
    expect(failures).toEqual([{ row: 3, column: "组别", code: "participant.import.unknownCategory", message: expect.any(String) }]);

    // The import is atomic: the valid row wrote nothing either.
    const list = await authed(request(app).get(`/api/competitions/${ctx.id}/participants`));
    expect(list.body.participants).toEqual([]);
  });
});

describe("the two event flags (cell L2's rule, V6)", () => {
  it("reads 1 as taking part, and 2 or blank as not, for each of the two flags", async () => {
    const ctx = await makeCompetition(`Flags ${suffix}`);
    const res = await upload(ctx.id, [
      validRow({ 姓名: "Un", 个人赛: "1", 团队赛: "1" }),
      validRow({ 姓名: "Deux", 个人赛: "2", 团队赛: "2" }),
      validRow({ 姓名: "Trois", 个人赛: null, 团队赛: null }),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(3);

    const list = await authed(request(app).get(`/api/competitions/${ctx.id}/participants`));
    // Only the three useful fields are compared: the endpoint renders more.
    const rows = (
      list.body.participants as {
        name: string;
        individualEvent: boolean;
        teamEvent: boolean;
      }[]
    )
      .map((p) => ({
        name: p.name,
        individualEvent: p.individualEvent,
        teamEvent: p.teamEvent,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(rows).toEqual([
      { name: "Deux", individualEvent: false, teamEvent: false },
      { name: "Trois", individualEvent: false, teamEvent: false },
      { name: "Un", individualEvent: true, teamEvent: true },
    ]);

    // Les comptes que le round individuel utilisera vraiment (spec §8 Q3).
    expect(list.body.counts).toMatchObject({
      total: 3,
      active: 3,
      individualEvent: 1,
      teamEvent: 1,
    });
    // V7: the `团队赛`=1 counted per school+group, the datum a later
    // team-formation stage will read.
    expect(list.body.counts.teamFlaggedBySchool).toHaveLength(1);
    expect(list.body.counts.teamFlaggedBySchool[0]).toMatchObject({
      schoolName: "卖鱼桥小学",
      categoryName: "一二年级组",
      count: 1,
    });
  });

  it("rejects any other value with its own named failure (V6)", async () => {
    const ctx = await makeCompetition(`Bad flags ${suffix}`);
    const individual = await upload(ctx.id, [validRow({ 个人赛: "是" })]);
    expect(individual.status).toBe(422);
    expect(individual.body.error.code).toBe("participant.import.invalidIndividualFlag");
    expect(individual.body.error.details.failures[0]).toMatchObject({ row: 2, column: "个人赛" });

    const team = await upload(ctx.id, [validRow({ 团队赛: "参加" })]);
    expect(team.status).toBe(422);
    expect(team.body.error.code).toBe("participant.import.invalidTeamFlag");
    expect(team.body.error.details.failures[0]).toMatchObject({ row: 2, column: "团队赛" });
  });

  it("parses a flag written as a numeric cell exactly like the same one written as text", async () => {
    const ctx = await makeCompetition(`Numeric flags ${suffix}`);
    // `1` (a number, `<v>1</v>`) and `"1"` (a shared string, `t="s"`) are two
    // representations Excel really produces depending on how the cell was
    // entered: `readSheetCells` must give the parser the same text.
    const res = await upload(ctx.id, [
      validRow({ 姓名: "Nombre", 个人赛: 1, 团队赛: 1 }),
      validRow({ 姓名: "Texte", 个人赛: "1", 团队赛: "1" }),
      validRow({ 姓名: "NombreDeux", 个人赛: 2, 团队赛: 2 }),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(3);

    const list = await authed(request(app).get(`/api/competitions/${ctx.id}/participants`));
    const byName = new Map(
      (
        list.body.participants as {
          name: string;
          individualEvent: boolean;
          teamEvent: boolean;
        }[]
      ).map((p) => [p.name, p]),
    );
    expect(byName.get("Nombre")).toMatchObject({ individualEvent: true, teamEvent: true });
    expect(byName.get("Texte")).toMatchObject({ individualEvent: true, teamEvent: true });
    expect(byName.get("NombreDeux")).toMatchObject({ individualEvent: false, teamEvent: false });
  });
});

describe("the columns the spec says to ignore (PAR-012, spec §6)", () => {
  it("imports a row whose ignored columns are all filled, and proves they are ignored", async () => {
    const ctx = await makeCompetition(`Ignored ${suffix}`);
    // `validRow` already fills `选手编号`, `年龄`, `省`, `市`, `区（县）` and `备注`.
    const res = await upload(ctx.id, [validRow({ 姓名: "张三" })]);
    expect(res.status).toBe(200);
    expect(res.body.warnings).toEqual([]);

    const participant = await prisma.participant.findFirstOrThrow({
      where: { competitionId: ctx.id },
      include: { school: true, category: true },
    });
    // Only the used columns wrote anything.
    expect(participant.name).toBe("张三");
    expect(participant.school.name).toBe("卖鱼桥小学");
    expect(participant.category.name).toBe("一二年级组");
    expect(participant.participantNumber).toBe(1); // not `选手编号`'s 901
    expect(participant.individualEvent).toBe(true);
    expect(participant.teamEvent).toBe(false);

    // The proof that "ignored" is not assumed: two rows that differ **only** by
    // the ignored columns are the same person for V5.
    const duplicate = await upload(ctx.id, [
      validRow({ 姓名: "王五", 选手编号: 1, 年龄: 8, 省: "浙江省", 备注: "" }),
      validRow({ 姓名: "王五", 选手编号: 2, 年龄: 12, 省: "江苏省", 备注: "autre" }),
    ]);
    expect(duplicate.status).toBe(422);
    expect(duplicate.body.error.code).toBe("participant.import.duplicateParticipant");
  });

  it("rejects a file missing one of the three required headers before reading any row (V1)", async () => {
    const ctx = await makeCompetition(`Missing column ${suffix}`);
    const headers = FIXTURE_HEADERS.filter((header) => header !== "学校名称");
    const res = await upload(ctx.id, [validRow()], headers);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("participant.import.missingRequiredColumn");
    expect(res.body.error.details.failures[0]).toMatchObject({ row: 0, column: "学校名称" });
  });

  it("rejects a row with no name and a row with no school, naming each (V3)", async () => {
    const ctx = await makeCompetition(`Required cells ${suffix}`);
    const res = await upload(ctx.id, [
      validRow({ 姓名: null }),
      validRow({ 学校名称: "   " }),
    ]);
    expect(res.status).toBe(422);
    const failures = res.body.error.details.failures as { row: number; code: string }[];
    expect(failures).toEqual([
      { row: 2, column: "姓名", code: "participant.import.nameRequired", message: expect.any(String) },
      { row: 3, column: "学校名称", code: "participant.import.schoolRequired", message: expect.any(String) },
    ]);
  });
});

describe("duplicates and warnings", () => {
  it("names both rows of a duplicate identity key (V5)", async () => {
    const ctx = await makeCompetition(`Duplicate ${suffix}`);
    const res = await upload(ctx.id, [
      validRow({ 姓名: "张三" }),
      validRow({ 姓名: "Autre" }),
      validRow({ 姓名: "张三" }),
    ]);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("participant.import.duplicateParticipant");
    const rows = (res.body.error.details.failures as { row: number }[]).map((f) => f.row);
    // La ligne fautive **et** celle qui réclamait déjà la clé, pas seulement la
    // seconde : le contrôleur voit la paire.
    expect(rows.sort()).toEqual([2, 4]);

    // Un même nom dans une autre école ou un autre groupe n'est pas un doublon.
    const fine = await upload(ctx.id, [
      validRow({ 姓名: "张三", 学校名称: "卖鱼桥小学" }),
      validRow({ 姓名: "张三", 学校名称: "文澜小学" }),
      validRow({ 姓名: "张三", 学校名称: "卖鱼桥小学", 组别: "U10" }),
    ]);
    expect(fine.status).toBe(200);
    expect(fine.body.created).toBe(3);
  });

  it("warns about a 比赛名称 that does not match, and imports anyway (V8)", async () => {
    const ctx = await makeCompetition(`Mismatch ${suffix}`);
    const res = await upload(ctx.id, [validRow({ 比赛名称: "Une autre compétition" })]);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMMITTED");
    expect(res.body.created).toBe(1);
    expect(res.body.warnings).toEqual([
      {
        row: 2,
        code: "participant.import.competitionNameMismatch",
        message: expect.any(String),
      },
    ]);
  });

  it("does not warn when 比赛名称 matches the competition, nor when it is blank", async () => {
    const ctx = await makeCompetition(`Match ${suffix}`);
    const matching = await upload(ctx.id, [validRow({}, `Match ${suffix}`)]);
    expect(matching.status).toBe(200);
    expect(matching.body.warnings).toEqual([]);

    const blank = await upload(ctx.id, [validRow({ 姓名: "Cellule vide", 比赛名称: null })]);
    expect(blank.status).toBe(200);
    expect(blank.body.warnings).toEqual([]);
  });

  it("skips the template's note row with a warning instead of a failure", async () => {
    const ctx = await makeCompetition(`Note row ${suffix}`);
    // La forme exacte du vrai fichier : une ligne dont seule la cellule `备注`
    // porte l'instruction `个人赛团队赛参加填写1，未参加空白或者是2`.
    const res = await upload(ctx.id, [noteRow(), validRow({ 姓名: "张三" })]);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.warnings).toEqual([
      { row: 2, code: "participant.import.noteRowSkipped", message: expect.any(String) },
    ]);
  });

  it("rejects a file with no data row, and one whose every row was a note (V2)", async () => {
    const ctx = await makeCompetition(`Empty ${suffix}`);
    const noRows = await upload(ctx.id, []);
    expect(noRows.status).toBe(422);
    expect(noRows.body.error.code).toBe("participant.import.emptyFile");
    expect(noRows.body.error.details.failures[0]).toMatchObject({ row: 0 });

    const onlyNotes = await upload(ctx.id, [noteRow(), noteRow("autre note")]);
    expect(onlyNotes.status).toBe(422);
    expect(onlyNotes.body.error.code).toBe("participant.import.emptyFile");

    // Rien n'a été écrit dans les deux cas.
    const list = await authed(request(app).get(`/api/competitions/${ctx.id}/participants`));
    expect(list.body.participants).toEqual([]);
  });

  it("rejects a body that is not a readable workbook, before writing any file or batch", async () => {
    const ctx = await makeCompetition(`Not excel ${suffix}`);
    const { body, boundary } = buildUploadBody(Buffer.from("ceci n'est pas un xlsx", "utf8"));
    const res = await authed(request(app).post(importUrl(ctx.id)))
      .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
      .send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("participant.import.notAnExcelFile");

    // Une archive illisible est rejetée par `readParticipantWorkbook`, donc **avant**
    // l'écriture du fichier et du lot (BLD-039 ne couvre que les lignes qui n'ont pas pu
    // être lues, pas un corps qui n'est pas un classeur). Rien n'est audité ici.
    const batches = await prisma.importBatch.findMany({ where: { competitionId: ctx.id } });
    expect(batches).toEqual([]);
  });

  it("rejects a request that carries no file part at all", async () => {
    const ctx = await makeCompetition(`No file ${suffix}`);
    const res = await authed(request(app).post(importUrl(ctx.id))).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("participant.import.noFile");
  });
});

describe("re-import (PAR-010, spec §4.5, Finding 10)", () => {
  it("keeps an unchanged row as it is, with the same number and the same account", async () => {
    const ctx = await makeCompetition(`Reimport same ${suffix}`);
    const first = await upload(ctx.id, [validRow({ 姓名: "张三" })]);
    expect(first.status).toBe(200);
    const credential = (first.body.credentials as Credential[])[0]!;

    const second = await upload(ctx.id, [validRow({ 姓名: "张三" })]);
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(0);
    expect(second.body.kept).toBe(1);
    expect(second.body.replaced).toBe(0);
    // Aucun nouvel identifiant : celui déjà imprimé reste valable.
    expect(second.body.credentials).toEqual([]);

    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: credential.participantId },
      include: { account: true },
    });
    expect(participant.participantNumber).toBe(credential.participantNumber);
    expect(participant.active).toBe(true);
    expect(participant.account!.username).toBe(credential.username);
  });

  it("applies a change of event flag in place, rather than replacing the student (Finding 10)", async () => {
    const ctx = await makeCompetition(`Reimport flag ${suffix}`);
    const first = await upload(ctx.id, [validRow({ 姓名: "张三", 团队赛: null })]);
    const credential = (first.body.credentials as Credential[])[0]!;

    // L'organisateur corrige une seule cellule `团队赛` : c'est la même personne,
    // pas un changement d'identité. La lecture littérale de §4.5 la désactiverait
    // et créerait une seconde ligne, orphanant tout résultat déjà écrit.
    const second = await upload(ctx.id, [validRow({ 姓名: "张三", 团队赛: "1" })]);
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(0);
    expect(second.body.kept).toBe(1);
    expect(second.body.replaced).toBe(0);
    expect(second.body.deactivated).toBe(0);
    expect(second.body.credentials).toEqual([]);

    const participants = await prisma.participant.findMany({
      where: { competitionId: ctx.id },
      include: { account: true },
    });
    // Une seule ligne, toujours la même, toujours active, avec son compte intact.
    expect(participants).toHaveLength(1);
    expect(participants[0]!.id).toBe(credential.participantId);
    expect(participants[0]!.participantNumber).toBe(credential.participantNumber);
    expect(participants[0]!.active).toBe(true);
    expect(participants[0]!.teamEvent).toBe(true);
    expect(participants[0]!.account!.username).toBe(credential.username);
  });

  it("deactivates the rows the new file no longer mentions, and re-activates one that comes back", async () => {
    const ctx = await makeCompetition(`Reimport omit ${suffix}`);
    const first = await upload(ctx.id, [
      validRow({ 姓名: "Reste" }),
      validRow({ 姓名: "Part", 学校名称: "文澜小学" }),
    ]);
    expect(first.body.created).toBe(2);

    const second = await upload(ctx.id, [validRow({ 姓名: "Reste" })]);
    expect(second.status).toBe(200);
    expect(second.body.deactivated).toBe(1);
    expect(second.body.kept).toBe(1);

    const gone = await prisma.participant.findFirstOrThrow({
      where: { competitionId: ctx.id, name: "Part" },
    });
    expect(gone.active).toBe(false);

    // La ligne désactivée qui revient réutilise sa propre ligne, pas une seconde.
    const third = await upload(ctx.id, [
      validRow({ 姓名: "Reste" }),
      validRow({ 姓名: "Part", 学校名称: "文澜小学" }),
    ]);
    expect(third.status).toBe(200);
    expect(third.body.created).toBe(0);
    expect(third.body.kept).toBe(2);
    const back = await prisma.participant.findUniqueOrThrow({ where: { id: gone.id } });
    expect(back.active).toBe(true);
    expect(back.participantNumber).toBe(gone.participantNumber);
  });
});

describe("access and lifecycle (ROL-002, PAR-009)", () => {
  it("refuses every endpoint to a session that is not a controller", async () => {
    const ctx = await makeCompetition(`Forbidden ${suffix}`);
    const asJudge = (req: request.Test) =>
      req.set("x-session-token", judgeToken).set("x-device-id", judgeDevice);

    const workbook = buildParticipantWorkbook([validRow()]);
    const { body, boundary } = buildUploadBody(workbook);
    const imported = await asJudge(request(app).post(importUrl(ctx.id)))
      .set("Content-Type", `multipart/form-data; boundary=${boundary}`)
      .send(body);
    expect(imported.status).toBe(403);
    expect(imported.body.error.code).toBe("participant.forbidden");

    const list = await asJudge(request(app).get(`/api/competitions/${ctx.id}/participants`));
    expect(list.status).toBe(403);
    expect(list.body.error.code).toBe("participant.forbidden");

    const credentials = await asJudge(
      request(app).get(`/api/competitions/${ctx.id}/participants/credentials`),
    );
    expect(credentials.status).toBe(403);
    expect(credentials.body.error.code).toBe("participant.forbidden");

    const added = await asJudge(request(app).post(`/api/competitions/${ctx.id}/participants`)).send({
      name: "张三",
      categoryId: ctx.byName.id,
      schoolName: "卖鱼桥小学",
    });
    expect(added.status).toBe(403);
    expect(added.body.error.code).toBe("participant.forbidden");
  });

  it("refuses an unauthenticated call", async () => {
    const ctx = await makeCompetition(`Anonymous ${suffix}`);
    const res = await request(app).get(`/api/competitions/${ctx.id}/participants`);
    expect(res.status).toBe(401);
  });

  it("refuses a whole-file import once the competition has left CREATED (PAR-009)", async () => {
    const ctx = await makeCompetition(`Published ${suffix}`);
    const before = await upload(ctx.id, [validRow({ 姓名: "Avant" })]);
    expect(before.status).toBe(200);

    await prisma.competition.update({ where: { id: ctx.id }, data: { status: "WAITING" } });

    const after = await upload(ctx.id, [validRow({ 姓名: "Après" })]);
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe("participant.import.notAllowedAfterPublish");

    // L'édition individuelle survit à cette coupure ([C] PAR-003) : c'est le seul
    // chemin qui reste une fois la compétition publiée.
    const participant = await prisma.participant.findFirstOrThrow({
      where: { competitionId: ctx.id, name: "Avant" },
    });
    const edited = await authed(
      request(app).patch(`/api/competitions/${ctx.id}/participants/${participant.id}`),
    ).send({ teamEvent: true });
    expect(edited.status).toBe(200);
    expect(edited.body.participant.teamEvent).toBe(true);
    // Un simple changement de drapeau ne remplace pas l'élève : pas de nouvel
    // identifiant (PAR-003 ne le fait que pour un changement de **nom**).
    expect(edited.body.credential).toBeNull();
  });

  it("404s on a competition that does not exist", async () => {
    const res = await upload("no-such-competition", [validRow()]);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("participant.notFound");
  });
});
