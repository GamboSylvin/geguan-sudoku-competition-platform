import type { MessageCatalogue } from "./en";

/** Chinese message catalogue — the second and, for now, last locale (ARCH-026). */
export const zh: MessageCatalogue = {
  common: {
    appName: "数独竞技场",
    loading: "加载中…",
    notFound: "未找到",
    validationFailed: "校验失败",
    internalError: "出错了",
  },
  placeholder: {
    title: "数独竞技场",
    subtitle: "基础框架已就绪，各页面将在后续单元中实现。",
  },
  auth: {
    title: "数独竞技场",
    chooseRole: "请选择您的身份",
    username: "用户名",
    password: "密码",
    submit: "登录",
    logout: "退出登录",
    invalidCredentials: "用户名或密码错误",
    role: {
      player: "选手",
      judge: "裁判",
      controller: "管理员",
    },
    landing: {
      subtitle: "您已登录。此页面为后续单元的占位页面。",
      signedInAs: "登录账号",
      player: "选手首页",
      judge: "裁判首页",
      controller: "管理员首页",
    },
  },
  competition: {
    title: "创建比赛",
    name: "比赛名称",
    description: "描述(可选)",
    categories: "组别",
    categoryCode: "代码",
    categoryName: "名称",
    addCategory: "添加组别",
    removeCategory: "移除",
    create: "创建比赛",
    wifiNote:
      "赛前请让网络/IT 团队妥善配置赛场 Wi-Fi——约 300 台平板同时连接,赛场 Wi-Fi 是最大的现实风险。",
    created: "比赛已创建",
    structure: "结构(自动创建)",
    rounds: "轮次",
    roundDuration: "时长(秒)",
    saveRound: "保存",
    saved: "已保存",
    publish: "发布",
    published: "已发布",
    entryLink: "参赛链接",
    bigScreenLink: "大屏链接",
    notReady: "尚不能发布,还缺少:",
    genericError: "出错了,请重试。",
    duration: {
      INDIVIDUAL1: "个人赛第 1 轮",
      INDIVIDUAL2: "个人赛第 2 轮",
      TEAM1: "团体赛第 1 轮",
      TEAM2: "团体赛第 2 轮",
    },
  },
};
