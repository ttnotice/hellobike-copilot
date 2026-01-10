import axios from "axios";
import * as vscode from "vscode";
import {
  getEditorTypeCode,
  getPluginInfo,
} from "./common";
import {
  CODE_GUARD_CONFIG_URL,
} from "./constants";

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


export const getConfig = async () => {
  try {
    const url = CODE_GUARD_CONFIG_URL;
    const response = await axios.get(url, {
      ...config,
      params: {
        productCode: 'cursor',
      },
    });
    logChannel.info("getConfig:", response.data);
    return response.data?.data || {};
  } catch (e: any) {
    logChannel.error("getConfig failed:", e.message);
    return [];
  }
};
 