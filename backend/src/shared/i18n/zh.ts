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
  rotation: {
    notATeamMember: "你不是本轮次任何队伍的在场队员。",
    rotationNotStarted: "该团队轮次尚未发题。",
    roundEnded: "该团队轮次已经结束。",
    staleHold: "该题目已经轮转给其他队员。",
    notARotationRound: "该轮次不是团队轮转轮次。",
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
    invalidMode: "不支持该显示模式。",
  },
  orchestrator: {
    roundNotRunning: "该轮次当前不在进行中。",
    participantNotFound: "该参赛选手不在此轮次中。",
    forbidden: "只有管理员可以执行该指令。",
    competitionClosed: "该比赛已结束或已取消，无法再执行任何指令。",
    stageNotFound: "该阶段不属于此比赛。",
    stageNotWaiting: "该阶段已经开始。",
    stageOutOfSequence: "前一个阶段尚未结束。",
    roundNotFound: "未找到该轮次。",
    roundNotInCompetition: "该轮次不属于此比赛。",
    nothingToPause: "当前没有运行中的计时器可以暂停。",
    nothingToResume: "当前没有已暂停的计时器可以恢复。",
    resetNotAllowed: "已结束或已取消的比赛无法重新开始。",
    teamNotFound: "未找到该队伍。",
    bigScreenForbidden: "大屏不能发送显示指令。",
  },
  judgeSupervision: {
    forbidden: "只有裁判或管理员可以使用此接口。",
    outOfRange: "该参赛选手不在您的负责范围内。",
  },
  question: {
    forbidden: "只有管理员可以管理题库。",
    notFound: "未找到该题组。",
    import: {
      noFile: "请选择要上传的 Excel 文件。",
      notAnExcelFile: "这不是可读取的 .xlsx 文件。",
      emptyFile: "文件中没有题目数据行。",
      missingRequiredColumn: "文件缺少必需的列。",
      variantRequired: "变体（*类目）为空。",
      irregularVariantUnsupported: "暂不支持导入不规则变体的题目文件。",
      unknownVariant: "无法识别该变体。",
      invalidPoints: "分数必须是大于或等于 1 的整数。",
      invalidGridWidth: "水平长度必须是正整数。",
      invalidGridHeight: "垂直长度必须是正整数。",
      unsupportedGridShape: "该宫格尺寸无法构成标准的宫分区。",
      givenColumnMissing: "缺少给定数字列。",
      invalidGivenGrid: "给定数字不是格式正确的宫格。",
      invalidAnswerGrid: "正确答案不是格式正确的宫格。",
      gridsNotComplementary: "给定数字与正确答案未能不重不漏地覆盖整个宫格。",
      mixedVariants: "一个文件只能包含同一种变体，该文件混合了多种变体。",
    },
    selection: {
      notIndividualRound: "只有个人赛轮次才有题目选择。",
      locked: "该轮次已进入准备阶段，无法再更改其题目选择。",
      invalidCount: "请正好选择 6 道题目。",
      duplicateIds: "同一道题目不能被重复选择。",
      notInPool: "所选题目中有不属于该组别题库的条目。",
    },
  },
};
