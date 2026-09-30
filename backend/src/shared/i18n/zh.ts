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
};
