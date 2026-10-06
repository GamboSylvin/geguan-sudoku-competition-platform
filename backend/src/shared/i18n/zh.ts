import type { MessageCatalogue } from "./en";

/**
 * Chinese message catalogue (ARCH-026). It has exactly the same shape as the
 * English one; a missing key is a type error, so the two cannot drift apart.
 * A third language is OPEN (U-51) and is deliberately not set up.
 */
export const zh: MessageCatalogue = {
  common: {
    ok: "好的",
    notFound: "未找到",
    validationFailed: "校验失败",
    internalError: "服务器内部错误",
  },
  health: {
    healthy: "正常",
    unhealthy: "异常",
    database: "数据库",
    redis: "Redis",
  },
  auth: {
    invalidCredentials: "用户名或密码错误",
    noSession: "未登录",
    sessionExpired: "会话已结束，请重新登录。",
    deviceTakenOver: "该账号已在另一台设备上登录。",
  },
  competition: {
    forbidden: "只有管理员可以管理比赛。",
    notFound: "未找到该比赛。",
    structureLocked: "该比赛已发布，无法再修改其组别、阶段和轮次。",
    readiness: {
      categoryRequired: "请至少添加一个组别。",
      participantsRequired: "每个组别至少需要一名参赛选手。",
      questionsRequired: "每个组别需要为两轮个人赛各分配一套题目。",
      judgeRangesRequired: "裁判负责范围必须覆盖所有参赛号。",
    },
  },
  judge: {
    forbidden: "只有管理员可以管理裁判。",
    notFound: "未找到该裁判。",
    assignmentNotFound: "未找到该裁判分配。",
    hasActiveAssignment: "该裁判仍被分配到一场尚未结束的比赛。",
  },
  round: {
    forbidden: "只有管理员可以执行该轮次操作。",
    devOnly: "该触发器仅在非生产环境可用。",
    competitionNotWaiting: "该比赛不在等待开始状态，无法触发第一轮。",
    stageMissing: "该比赛缺少第一阶段。",
    roundMissing: "该阶段缺少第一轮。",
    alreadyActive: "该比赛已有正在进行的轮次。",
    noActiveTimer: "该比赛当前没有运行中的轮次计时器。",
  },
  gameplay: {
    forbidden: "你无法访问该轮的答题棋盘。",
    roundNotFound: "未找到该轮次。",
    notActive: "该轮次当前未开始。",
    notAParticipant: "你不是该轮次的参赛选手。",
  },
  scoring: {
    noQuestions: "该轮次没有可评分的题目。",
  },
  ranking: {
    forbidden: "只有管理员可以查看排名。",
    notFound: "未找到该排名。",
  },
  bigScreen: {
    unauthorized: "该大屏链接无效。",
  },
};
