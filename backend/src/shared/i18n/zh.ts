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
};
