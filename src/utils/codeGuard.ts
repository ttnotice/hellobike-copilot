import axios from "axios";
import * as vscode from "vscode";
import {
  getEditorTypeCode,
  getGitInfo,
  getGitUserConfigFromCommand,
  getPluginInfo,
} from "./common";
import {
  CODE_GUARD_CONFIG_URL,
  CODE_GUARD_LOGOUT_URL,
  CODE_GUARD_REPORT_URL,
} from "./constants";
import { getCursorUserInfo } from "./cursorUser";

const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

const env = vscode.env;

const repoRegex =
  /^(ssh:\/\/git@gitlab\.hellobike\.cn:10022|https:\/\/gitlab\.hellobike\.cn).*/;
const userRegex = /@hellobike\.com$/;

const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

export const register = async () => {
  let gitInfo = await getGitInfo(workspacePath);
  let gitUserInfo = await getGitUserConfigFromCommand();
  let pluginInfo = await getPluginInfo();
  logChannel.info("pluginInfo", pluginInfo);

  const userInfo = await getCursorUserInfo();
  logChannel.info("userInfo", userInfo);
  if (
    gitInfo.remote &&
    gitUserInfo.email &&
    repoRegex.test(gitInfo.remote) &&
    !userRegex.test(gitUserInfo.email)
  ) {
    vscode.window.showInformationMessage(
      `Git user: ${gitUserInfo.email}为非hello邮箱, 请检查后重新配置!`
    );
  }

  const payload = {
    gitUser: gitUserInfo.name ? gitUserInfo.name : userInfo.account,
    gitUserEmail: gitUserInfo.email ? gitUserInfo.email : userInfo.email,
    ideaVersion: vscode.version,
    ideaProductCode: vscode.env.appName,
    nodeVersion: process.version,
    pluginVersion: pluginInfo?.version,
    gitUrl: gitInfo.remote,
  };
  // const payload = {"gitUser":"wangxiaoxu","gitUserEmail":"wangxiaoxu@hellobike.com", "ideaVersion":"1.105.1","ideaProductCode":"Cursor","nodeVersion":"v22.20.0","gitUrl":"https://gitlab.hellobike.cn/fund/AppFinancePaymentService"};
  logChannel.info("register payload", payload, CODE_GUARD_REPORT_URL);
  try {
    const response = await axios.post(CODE_GUARD_REPORT_URL, payload, config);
    if (response.status === 200) {
      logChannel.info("register responseData:", response.data);
    } else {
      logChannel.error("register failed:", response.status, response.data);
    }
  } catch (e: any) {
    logChannel.error("register failed:", e.message);
  }
};

export const reportActivity = async (type: number, node: any) => {
  let gitUserInfo = await getGitUserConfigFromCommand();
  let pluginInfo = await getPluginInfo();
  let gitInfo = await getGitInfo(workspacePath);
  const payload = node
    ? {
        gitUserEmail: gitUserInfo.email,
        gitUrl: gitInfo.remote,
        ideaVersion: vscode.version,
        nodeVersion: process.version,
        pluginVersion: pluginInfo?.version,
        type,
        detail: node,
        groupType: node.type,
        source: getEditorTypeCode(),
      }
    : {
        gitUserEmail: gitUserInfo.email,
        gitUrl: gitInfo.remote,
        ideaVersion: vscode.version,
        nodeVersion: process.version,
        pluginVersion: pluginInfo?.version,
        groupType: node.type,
        type,
        source: getEditorTypeCode(),
      };

  try {
    logChannel.info("reportActivity payload:", payload);
    const response = await axios.put(CODE_GUARD_REPORT_URL, payload, config);
    if (response.status === 200) {
      logChannel.info("reportActivity:", response.data);
    } else {
      logChannel.error(
        "reportActivity failed:",
        response.status,
        response.data
      );
    }
  } catch (e: any) {
    console.error("reportActivity failed:", e.message);
    logChannel.error("reportActivity failed:", e.message);
  }
};

export const getConfig = async () => {
  try {
    const url = CODE_GUARD_CONFIG_URL;
    const response = await axios.get(url, {
      ...config,
      params: {
        productCode: vscode.env.appName,
      },
    });
    logChannel.info("getConfig:", response.data);
    return response.data?.data || {};
  } catch (e: any) {
    logChannel.error("getConfig failed:", e.message);
    return [];
  }
};

export const logOut = async () => {
  try {
    let gitUserInfo = await getGitUserConfigFromCommand();
    const url = CODE_GUARD_LOGOUT_URL;
    const response = await axios.put(
      url,
      {
        source: getEditorTypeCode(),
        email: gitUserInfo.email,
      },
      config
    );
    logChannel.info("logOut:", response.data);
    return response.data?.data || {};
  } catch (e: any) {
    logChannel.error("logOut failed:", e.message);
    return [];
  }
};
