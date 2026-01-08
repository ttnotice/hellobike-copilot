import axios, { AxiosInstance } from "axios";
import { GET_APP_INFO_URL, CODEMANAGER_SSO_TOKEN } from "./constants";
import * as vscode from "vscode";

const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

export const getAppInfo = async (appId: string) => {
  const params = {
    name: appId,
  };
  logChannel.info("getAppInfo params:", params);
  try {
    const response = await axios.get(GET_APP_INFO_URL, {
      ...config,
      headers: {
        ...config.headers,
        "sso-token": CODEMANAGER_SSO_TOKEN,
      },
      params: params,
    });

    if (response.status === 200) {
      logChannel.info("getAppInfo responseData:", response.data);
      return response.data?.data || [];
    } else {
      logChannel.error("getAppInfo failed:", response.status, response.data);
      return [];
    }
  } catch (e: any) {
    logChannel.error("getAppInfo failed:", e.message);
    return [];
  }
};
