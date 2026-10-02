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
};
