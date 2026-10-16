import request from "supertest";
import { createApp } from "../src/app";
import { prisma, disconnectPrisma } from "../src/infra/prisma";
import { disconnectRedis } from "../src/infra/redis";
import { identityService } from "../src/modules/identity";
import { competitionService } from "../src/modules/competition";

/**
 * BLD-052: the `School` CRUD surface at `/api/competitions/:id/schools`.
 *
 * This file locks in what was decided, nothing invented: the list with the counts
 * that say whether a delete is possible, creation (with its derived `sequence` and
 * the rejection of an already-taken name), rename-only, and above all the deletion
 * guard — a 409 while a `Participant` or a `Team` still points at the school, exactly
 * like `judge.service.ts`'s ROL-010 guard — then a delete that succeeds once the
 * school is emptied. Also covered: 401 with no session, 403 from a non-controller
 * session, and 404 on an unknown id or one belonging to another competition.
 */
const app = createApp();
const PASSWORD = "test-pass-1234";
const suffix = Math.random().toString(36).slice(2, 8);

const users = {
  controller: `it52-controller-${suffix}`,
  judge: `it52-judge-${suffix}`,
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

async function makeCompetition(name: string) {
  const competition = await competitionService.createCompetition({
    name,
    categories: [{ code: "U8", name: "Under 8" }],
  });
  createdCompetitionIds.push(competition.id);
  return competition;
}

/** A school created directly through Prisma, bypassing the API. */
async function seedSchool(competitionId: string, name: string, sequence: number) {
  return prisma.school.create({ data: { competitionId, name, sequence } });
}

/** A participant attached to this school, to arm the deletion guard. */
async function seedParticipant(competitionId: string, schoolId: string, name: string) {
  const category = await prisma.competitionCategory.findFirstOrThrow({
    where: { competitionId },
  });
  return prisma.participant.create({
    data: {
      competitionId,
      categoryId: category.id,
      schoolId,
      name,
      participantNumber: Math.floor(Math.random() * 100000),
      sequence: 1,
    },
  });
}

beforeAll(async () => {
  await createAccount(users.controller, "CONTROLLER");
  await createAccount(users.judge, "JUDGE");

  const controller = await login("controller", users.controller);
  controllerToken = controller.body.token;
  controllerDevice = controller.body.deviceId;

  const judge = await login("judge", users.judge);
  judgeToken = judge.body.token;
  judgeDevice = judge.body.deviceId;
});

afterAll(async () => {
  // Cascades take schools, participants, categories, stages, rounds and settings with them.
  await prisma.competition.deleteMany({ where: { id: { in: createdCompetitionIds } } });
  await prisma.account.deleteMany({ where: { username: { in: Object.values(users) } } });
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
});

function authed(req: request.Test): request.Test {
  return req
    .set("x-session-token", controllerToken)
    .set("x-device-id", controllerDevice);
}

function schoolsPath(competitionId: string): string {
  return `/api/competitions/${competitionId}/schools`;
}

describe("school CRUD (BLD-052)", () => {
  it("lists the schools with the counts that decide whether one may be removed", async () => {
    const competition = await makeCompetition(`Schools list ${suffix}`);
    const empty = await seedSchool(competition.id, `Empty ${suffix}`, 1);
    const used = await seedSchool(competition.id, `Used ${suffix}`, 2);
    await seedParticipant(competition.id, used.id, `P ${suffix}`);

    const res = await authed(request(app).get(schoolsPath(competition.id))).send();
    expect(res.status).toBe(200);

    const rows = res.body.schools as {
      id: string;
      participantCount: number;
      teamCount: number;
    }[];
    expect(rows.map((row) => row.id)).toEqual([empty.id, used.id]);
    // Non-null assertions: the index lookup was just checked right above.
    expect(rows[0]!.participantCount).toBe(0);
    expect(rows[0]!.teamCount).toBe(0);
    expect(rows[1]!.participantCount).toBe(1);
  });

  it("creates a school, sorting it after the existing ones", async () => {
    const competition = await makeCompetition(`Schools create ${suffix}`);
    await seedSchool(competition.id, `First ${suffix}`, 1);

    const res = await authed(request(app).post(schoolsPath(competition.id))).send({
      name: `Second ${suffix}`,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(`Second ${suffix}`);
    expect(res.body.sequence).toBe(2);
    expect(res.body.participantCount).toBe(0);

    const listed = await authed(request(app).get(schoolsPath(competition.id))).send();
    expect(listed.body.schools.map((row: { name: string }) => row.name)).toEqual([
      `First ${suffix}`,
      `Second ${suffix}`,
    ]);
  });

  it("refuses a name this competition already uses", async () => {
    const competition = await makeCompetition(`Schools clash ${suffix}`);
    await seedSchool(competition.id, `Taken ${suffix}`, 1);

    const res = await authed(request(app).post(schoolsPath(competition.id))).send({
      name: `Taken ${suffix}`,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("school.nameTaken");
  });

  it("renames a school and leaves the untouched field alone", async () => {
    const competition = await makeCompetition(`Schools rename ${suffix}`);
    const school = await seedSchool(competition.id, `Before ${suffix}`, 3);

    const res = await authed(
      request(app).patch(`${schoolsPath(competition.id)}/${school.id}`),
    ).send({ name: `After ${suffix}` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`After ${suffix}`);
    expect(res.body.sequence).toBe(3);

    const stored = await prisma.school.findUniqueOrThrow({ where: { id: school.id } });
    expect(stored.name).toBe(`After ${suffix}`);
    expect(stored.sequence).toBe(3);
  });

  it("refuses a rename onto a name another school of this competition holds", async () => {
    const competition = await makeCompetition(`Schools rename clash ${suffix}`);
    const one = await seedSchool(competition.id, `One ${suffix}`, 1);
    await seedSchool(competition.id, `Two ${suffix}`, 2);

    const res = await authed(
      request(app).patch(`${schoolsPath(competition.id)}/${one.id}`),
    ).send({ name: `Two ${suffix}` });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("school.nameTaken");
  });

  it("refuses to delete a school that still has participants, then allows it once empty", async () => {
    const competition = await makeCompetition(`Schools guard ${suffix}`);
    const school = await seedSchool(competition.id, `Guarded ${suffix}`, 1);
    const participant = await seedParticipant(competition.id, school.id, `P ${suffix}`);

    const blocked = await authed(
      request(app).delete(`${schoolsPath(competition.id)}/${school.id}`),
    ).send();
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("school.hasParticipants");
    expect(blocked.body.error.details.participants).toBe(1);
    expect(await prisma.school.findUnique({ where: { id: school.id } })).not.toBeNull();

    // Emptying the school is the controller's job; the guard is not bypassable.
    await prisma.participant.delete({ where: { id: participant.id } });

    const allowed = await authed(
      request(app).delete(`${schoolsPath(competition.id)}/${school.id}`),
    ).send();
    expect(allowed.status).toBe(204);
    expect(await prisma.school.findUnique({ where: { id: school.id } })).toBeNull();
  });

  it("refuses to delete a school that still has a team", async () => {
    const competition = await makeCompetition(`Schools team guard ${suffix}`);
    const school = await seedSchool(competition.id, `Teamed ${suffix}`, 1);
    const category = await prisma.competitionCategory.findFirstOrThrow({
      where: { competitionId: competition.id },
    });
    await prisma.team.create({
      data: {
        competitionId: competition.id,
        categoryId: category.id,
        schoolId: school.id,
        name: `Team ${suffix}`,
        sequence: 1,
      },
    });

    const res = await authed(
      request(app).delete(`${schoolsPath(competition.id)}/${school.id}`),
    ).send();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("school.hasTeam");
    expect(res.body.error.details.teams).toBe(1);
  });

  it("404s on a school of another competition, and on a competition that does not exist", async () => {
    const mine = await makeCompetition(`Schools mine ${suffix}`);
    const theirs = await makeCompetition(`Schools theirs ${suffix}`);
    const foreign = await seedSchool(theirs.id, `Foreign ${suffix}`, 1);

    const wrongCompetition = await authed(
      request(app).patch(`${schoolsPath(mine.id)}/${foreign.id}`),
    ).send({ name: `Stolen ${suffix}` });
    expect(wrongCompetition.status).toBe(404);
    expect(wrongCompetition.body.error.code).toBe("school.notFound");

    const missingSchool = await authed(
      request(app).delete(`${schoolsPath(mine.id)}/no-such-school`),
    ).send();
    expect(missingSchool.status).toBe(404);

    const missingCompetition = await authed(
      request(app).get("/api/competitions/no-such-competition/schools"),
    ).send();
    expect(missingCompetition.status).toBe(404);
    expect(missingCompetition.body.error.code).toBe("competition.notFound");
  });

  it("refuses a judge session", async () => {
    const competition = await makeCompetition(`Schools judge ${suffix}`);
    const res = await request(app)
      .get(schoolsPath(competition.id))
      .set("x-session-token", judgeToken)
      .set("x-device-id", judgeDevice)
      .send();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("school.forbidden");
  });

  it("refuses a request with no session", async () => {
    const competition = await makeCompetition(`Schools anon ${suffix}`);
    const res = await request(app).get(schoolsPath(competition.id)).send();
    expect(res.status).toBe(401);
  });

  it("rejects a body that carries anything but the name", async () => {
    const competition = await makeCompetition(`Schools strict ${suffix}`);
    const res = await authed(request(app).post(schoolsPath(competition.id))).send({
      name: `Strict ${suffix}`,
      sequence: 9,
    });
    expect(res.status).toBe(400);
  });
});
