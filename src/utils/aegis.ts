import axios, { AxiosInstance } from "axios";
import { AEGIS_UNCOVEREDINFO_URL } from "./constants";
import * as vscode from "vscode";

const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

const env = vscode.env;

const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

export const getUnCoveredInfo = async (gtUnCoveredTimes: number) => {
  const payload = {
    serviceName: "AppRobotaxiCoreService",
    env: "pro",
    gtUnCoveredTimes,
  };
  logChannel.info("getlUnCoveredInfo payload", payload);
  try {
    const response = await axios.post(AEGIS_UNCOVEREDINFO_URL, payload, config);
    if (response.status === 200) {
      logChannel.info("getlUnCoveredInfo responseData:", response.data);
      return response.data?.data || [];
    } else {
      logChannel.error(
        "getlUnCoveredInfo failed:",
        response.status,
        response.data
      );
    }
  } catch (e: any) {
    logChannel.error("getlUnCoveredInfo failed:", e.message);
    return [];
  }
};
