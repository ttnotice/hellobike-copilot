// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as childProcess from "child_process";
import * as vscode from "vscode";
import WebSocket from "ws";
import { reportActivity } from "./codeGuard";
import {
  checkLogIn,
  executeDelete,
  executeUpdate,
  findFilesByRegex,
  getEditorTypeCode,
  getGitInfo,
  getGitUserConfig,
  getGitUserConfigFromCommand,
  getProjectPath,
  popLogin,
} from "./common";
import { CODE_GUARD_WS_URL, HAS_LOGIN_KEY, METIS_URL } from "./constants";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

// 定义重连间隔时间（毫秒）
const reconnectInterval = 15000;

// 定义心跳间隔时间（毫秒）- 设置为 20 秒，确保在服务器超时前发送心跳
const heartbeatInterval = 20000;

let reconnectIntervalId: NodeJS.Timeout | null = null;

let heartbeatIntervalId: NodeJS.Timeout | null = null;

// 创建WebSocket连接的函数
export const createWebSocket = async (
  context: vscode.ExtensionContext,
  HAS_EXECUTED_KEY: string
) => {
  try {
    let email;
    try {
      let gitInfo = await getGitUserConfig();
      logChannel.info("gitInfo", gitInfo);

      if (!gitInfo.email) {
        gitInfo = await getGitUserConfigFromCommand();
      } else {
        email = gitInfo.email;
      }
      if (!gitInfo.email) {
        return;
      } else {
        email = gitInfo.email;
      }
      logChannel.info("gitInfo2", gitInfo);
    } catch (error) {
      logChannel.error("email is null");
      return;
    }
    let gitProjectInfo = await getGitInfo(workspacePath);
    logChannel.info("gitProjectInfo", gitProjectInfo);
    // let pluginInfo = await getPluginInfo();
    const wsUrl = CODE_GUARD_WS_URL + email + "/" + getEditorTypeCode();
    var ws = new WebSocket(wsUrl);

    // 监听WebSocket连接成功事件
    ws.on("open", () => {
      logChannel.info("WebSocket连接已建立");
      if (reconnectIntervalId) {
        clearInterval(reconnectIntervalId);
        reconnectIntervalId = null;
      }
      // 启动心跳机制
      startHeartbeat(
        ws,
        gitProjectInfo.remote || "",
        context,
        HAS_EXECUTED_KEY
      );
    });

    // 监听WebSocket接收到消息事件
    ws.on("message", data => {
      logChannel.info("收到消息:", data.toString());
      if (data.toString().startsWith("{") && data.toString().endsWith("}")) {
        try {
          const receivedData = JSON.parse(data.toString());
          logChannel.info("Received JSON:", receivedData);
          const cfg = vscode.workspace.getConfiguration("HCopilot");
          let enabled = cfg.get<boolean>("enable", true);
          logChannel.info("收到消息 HCopilot.enable 值:", enabled);
          if (receivedData.status) {
            if (receivedData.status === "unauthenticated" && enabled) {
              // (async () => {
              //   try {
              //     logChannel.info("显示 login 弹窗");
              //     vscode.commands.executeCommand(
              //       "setContext",
              //       HAS_LOGIN_KEY,
              //       false
              //     );

              //     // 添加延迟确保弹窗能正确显示
              //     await new Promise(resolve => setTimeout(resolve, 100));
              //     const result = await vscode.window.showInformationMessage(
              //       `当前用户未登录, 请登录后使用`,
              //       { modal: false },
              //       "登录"
              //     );
              //     logChannel.info("弹窗结果:", result);

              //     if (result === "登录") {
              //       childProcess.exec(
              //         `open "https://login.dingtalk.com/oauth2/auth?redirect_uri=http%3a%2f%2ffat-aegis-cov.hellobike.cn%2fauth%3fsource=${getEditorTypeCode()}&response_type=code&client_id=dingyva9yaub8yxrno9m&scope=openid+corpid&state=dddd&prompt=consent"`
              //       );
              //     }
              //     reportActivity(18, receivedData);
              //   } catch (error) {
              //     console.error("执行登录时发生错误:", error);
              //     logChannel.error("执行登录时发生错误:", error);
              //   }
              // })();

              // 确认登录弹窗，登录中状态两分钟内不弹窗，否则就一直弹
              const loginStatus = checkLogIn(context);
              logChannel.info("loginStatus:", loginStatus);
              if (loginStatus.startsWith("2_")) {
                // 提取时间戳（"2_" 之后的字符串）
                const timestampStr = loginStatus.substring(2);
                const timestamp = parseInt(timestampStr, 10);
                const currentTime = Date.now();
                const twoMinutes = 2 * 60 * 1000; // 2分钟的毫秒数
                logChannel.info(
                  "loginStatus currentTime:",
                  currentTime,
                  "timestamp",
                  timestamp
                );
                // 如果超过2分钟，将状态改为1（未登录）
                if (currentTime - timestamp > twoMinutes) {
                  context.globalState.update(HAS_LOGIN_KEY, "1");
                  logChannel.info(
                    "loginStatus 登录中状态已超时，重置为未登录状态"
                  );
                } else {
                  // 未超过2分钟，直接返回
                  return;
                }
              }
              popLogin(context);
              reportActivity(18, receivedData);
              return;
            } else {
              context.globalState.update(HAS_LOGIN_KEY, "3");
            }
          }
          // 在右下角弹出提醒框
          // vscode.window
          //   .showInformationMessage(
          //     `### ${receivedData.title}\n\r${receivedData.content}`,
          //     "去处理"
          //   )
          // type=1: Metis代码质量问题通知，type=2: 告警通知（Disaster Alert）
          // 这两种都是需要用户点击处理的通知消息，会显示title和content，点击后跳转到对应页面
          // type=1: Metis代码质量问题通知，type=2: 告警通知（Disaster Alert）
          // 这两种都是需要用户点击处理的通知消息，会显示title和content，点击后跳转到对应页面
          if (receivedData.type === 1 || receivedData.type === 2) {
            logChannel.info("显示 type 1/2 弹窗");
            vscode.window
              .showInformationMessage(
                `${receivedData.title}: ${receivedData.content}
              `,
                "去处理"
              )
              .then(result => {
                if (result === "去处理") {
                  if (receivedData.issueKey) {
                    childProcess.exec(
                      `open ${METIS_URL}/browse/${receivedData.issueKey}`
                    );
                    reportActivity(
                      receivedData.type === 1 ? 13 : 14,
                      receivedData
                    );
                  } else {
                    childProcess.exec(`open ${receivedData.url}`);
                  }
                }
              });
            if (receivedData.detail && receivedData.detail.issueKey) {
              ws.send(
                '{"key":"' +
                  receivedData.detail.issueKey +
                  '","email":"' +
                  email +
                  '","status":1,"source":' +
                  getEditorTypeCode() +
                  "}"
              );
            } else {
              let urls = receivedData.url.split("%2F");
              ws.send(
                '{"key":"' +
                  urls[urls.length - 1] +
                  '","email":"' +
                  email +
                  '","status":1,"source":' +
                  getEditorTypeCode() +
                  "}"
              );
            }
          }
          // type=3: 规则下发通知，来自规则下发平台，包含规则数据（groupName、detail、directory等）
          // 用于将prompt规则下发到项目的.cursor/rules目录，会调用executeUpdate或executeDelete处理
          if (receivedData.type === 3) {
            logChannel.info("Received data1: type=3");
            // 定义更新执行函数

            logChannel.info("Received data2:");
            // 将所有检查逻辑包装在异步函数中，确保所有异步操作完成后再使用 pop 值
            (async () => {
              let pop = true;
              // 检查 git 组名限制
              if (
                receivedData.gitlabGroup &&
                receivedData.gitlabGroup.length > 0
              ) {
                logChannel.info("Received data21:");
                // 异步检查 git 组名
                // 获取当前 git URL
                const workspacePath =
                  vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
                const gitInfo = await getGitInfo(workspacePath);
                if (gitInfo.remote) {
                  // 提取最后两个 / 之间的字符串
                  const urlParts = gitInfo.remote.split("/");
                  if (urlParts.length >= 2) {
                    const groupName = urlParts[urlParts.length - 2]; // 倒数第二个部分
                    logChannel.info(`当前项目组名: ${groupName}`);
                    logChannel.info(
                      `允许的组名列表: ${receivedData.gitlabGroup}`
                    );

                    // 判断组名是否在允许的列表中
                    if (receivedData.gitlabGroup.includes(groupName)) {
                      logChannel.info(
                        `项目组 ${groupName} 在允许列表中，继续执行更新`
                      );
                      pop = true;
                    } else {
                      logChannel.info(
                        `项目组 ${groupName} 不在允许列表中，跳过更新`
                      );
                      pop = false;
                      logChannel.info("Received data23 pop:", pop);
                      // 如果组名不在允许列表中，直接返回，不执行后续操作
                      return;
                    }
                  } else {
                    logChannel.warn("无法从 git URL 中提取组名");
                    // 如果无法提取组名，继续执行更新
                    pop = true;
                  }
                } else if (
                  receivedData.gitlabProjects &&
                  receivedData.gitlabProjects.length > 0
                ) {
                  // 检查当前 git URL 是否在 gitlabProjects 列表中
                  const currentGitUrl = gitInfo.remote;
                  logChannel.info(`当前 git URL: ${currentGitUrl}`);
                  logChannel.info(
                    `允许的项目列表: ${JSON.stringify(
                      receivedData.gitlabProjects
                    )}`
                  );

                  // 检查当前 URL 是否在允许的项目列表中
                  const isProjectAllowed = receivedData.gitlabProjects.some(
                    (project: any) => {
                      return project.name === currentGitUrl;
                    }
                  );

                  if (isProjectAllowed) {
                    logChannel.info(
                      `当前项目 ${currentGitUrl} 在允许列表中，继续执行更新`
                    );
                    pop = true;
                  } else {
                    logChannel.info(
                      `当前项目 ${currentGitUrl} 不在允许列表中，跳过更新`
                    );
                    pop = false;
                    logChannel.info("Received data23 pop:", pop);
                    // 如果项目不在允许列表中，直接返回，不执行后续操作
                    return;
                  }
                } else {
                  logChannel.warn("无法获取 git 远程仓库信息");
                  // 如果无法获取 git 信息，继续执行更新
                  pop = true;
                }
              }

              if (
                receivedData.gitlabProjects &&
                receivedData.gitlabProjects.length > 0
              ) {
                logChannel.info("Received data21:");
                // 异步检查 git 组名
                // 获取当前 git URL
                const workspacePath =
                  vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
                const gitInfo = await getGitInfo(workspacePath);
                if (gitInfo.remote) {
                  // 提取最后两个 / 之间的字符串
                  // 检查当前 git URL 是否在 gitlabProjects 列表中
                  const currentGitUrl = gitInfo.remote;
                  logChannel.info(`当前 git URL: ${currentGitUrl}`);
                  logChannel.info(
                    `允许的项目列表: ${JSON.stringify(
                      receivedData.gitlabProjects
                    )}`
                  );

                  // 检查当前 URL 是否在允许的项目列表中
                  const isProjectAllowed = receivedData.gitlabProjects.some(
                    (project: any) => {
                      return project.name === currentGitUrl;
                    }
                  );

                  if (isProjectAllowed) {
                    logChannel.info(
                      `当前项目 ${currentGitUrl} 在允许列表中，继续执行更新`
                    );
                    pop = true;
                  } else {
                    logChannel.info(
                      `当前项目 ${currentGitUrl} 不在允许列表中，跳过更新`
                    );
                    pop = false;
                    logChannel.info("Received data23 pop:", pop);
                    // 如果项目不在允许列表中，直接返回，不执行后续操作
                    return;
                  }
                } else {
                  logChannel.warn("无法获取 git 远程仓库信息");
                  // 如果无法获取 git 信息，继续执行更新
                  pop = true;
                }
              }
              if (receivedData.action === 17) {
                logChannel.info("Received data24:", receivedData.groupName);
                logChannel.info("Received data24 action:", receivedData.action);
                logChannel.info(
                  "Received data24 receivedData:",
                  JSON.stringify(receivedData)
                );
                // 使用 Promise 确保异步执行，并添加延迟确保弹窗能正确显示
                try {
                  logChannel.info(
                    "Received data24 receivedData.detail:",
                    receivedData.detail
                  );
                  let popTmp = false;
                  const detailArray = JSON.parse(receivedData.detail);
                  await Promise.all(
                    detailArray.map(async (item: any) => {
                      const tsFilesDelete = await findFilesByRegex(
                        getProjectPath() +
                          "/" +
                          (receivedData.directory
                            ? receivedData.directory
                            : getEditorTypeCode() === 2
                            ? ".cursor"
                            : ".kiro"),
                        new RegExp(
                          `${item}.*\\${
                            getEditorTypeCode() === 2 ? ".mdc" : ".md"
                          }$`
                        ),
                        true
                      );
                      logChannel.info(
                        "Received data24 tsFilesDelete:",
                        tsFilesDelete,
                        "length",
                        tsFilesDelete.length,
                        "item",
                        item
                      );
                      if (tsFilesDelete && tsFilesDelete.length > 0) {
                        popTmp = true;
                      }
                      logChannel.info("Received data24 popTmp:", popTmp);
                    })
                  );
                  pop = popTmp;
                  logChannel.info("Received data245 pop:", pop);
                } catch (error) {
                  logChannel.error("执行删除时发生错误:", error);
                }
              }
              logChannel.info("Received data23 pop:", pop);

              logChannel.info("Received data2361 pop:", pop);
              await new Promise(resolve => setTimeout(resolve, 100));
              logChannel.info("Received data236 pop:", pop);
              if (pop) {
                receivedData.action && receivedData.action === 17
                  ? await await executeDelete(receivedData, context, ws)
                  : await await executeUpdate(receivedData, context, ws);
              }
            })();
            logChannel.info("Received data2:");
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          logChannel.error("Received data was:", data.toString());
        }
      } else if (data.toString() === "ping") {
        ws.send("pong");
      } else {
        logChannel.info("Received data was:", data.toString());
      }
    });

    // 监听WebSocket连接错误事件
    ws.on("error", error => {
      console.error("WebSocket连接出错:", error);
      context.globalState.update(HAS_EXECUTED_KEY, false).then(() => {
        logChannel.info("Task execution marked in global state", error);
      });
      // 关闭WebSocket连接
      closeWebSocket(ws);
      // 尝试重新连接
      reconnect(context, HAS_EXECUTED_KEY);
    });

    // 监听WebSocket连接关闭事件
    ws.on("close", (code, reason) => {
      // 解析 reason（可能是 Buffer）
      let reasonStr = "";
      if (Buffer.isBuffer(reason)) {
        reasonStr = reason.toString("utf8");
      } else if (typeof reason === "string") {
        reasonStr = reason;
      } else {
        reasonStr = JSON.stringify(reason);
      }
      logChannel.info("WebSocket连接已关闭, 代码:", code, "原因:", reasonStr);
      context.globalState.update(HAS_EXECUTED_KEY, false).then(() => {
        logChannel.info("Task execution marked in global state: false");
      });
      // 关闭WebSocket连接
      closeWebSocket(ws);

      // 如果是空闲超时（1001）或其他正常关闭（1000），立即重连
      // 其他错误码则延迟重连
      if (code === 1001 || code === 1000) {
        logChannel.info("检测到空闲超时或正常关闭，立即尝试重连...");
        // 立即尝试重连，不等待
        setTimeout(() => {
          createWebSocket(context, HAS_EXECUTED_KEY);
        }, 1000);
      } else {
        // 其他错误，延迟重连
        reconnect(context, HAS_EXECUTED_KEY);
      }
    });
  } catch (error) {
    console.error("创建WebSocket连接时出错:", error);
    // 尝试重新连接
    reconnect(context, HAS_EXECUTED_KEY);
  }
};

// 关闭WebSocket连接的函数
export const closeWebSocket = (ws: any) => {
  logChannel.info(
    "closeWebSocket:",
    ws,
    "heartbeatIntervalId",
    heartbeatIntervalId
  );
  if (heartbeatIntervalId) {
    // 清除心跳定时器
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  if (reconnectIntervalId) {
    clearInterval(reconnectIntervalId);
    reconnectIntervalId = null;
  }
  if (ws) {
    // 关闭WebSocket连接
    ws.close();
    ws = null;
  }
};

// 尝试重新连接的函数
export const reconnect = (
  context: vscode.ExtensionContext,
  HAS_EXECUTED_KEY: string
) => {
  logChannel.info("reconnect heartbeatIntervalId", heartbeatIntervalId);
  if (reconnectIntervalId) {
    clearInterval(reconnectIntervalId);
    reconnectIntervalId = null;
  }
  reconnectIntervalId = setTimeout(() => {
    logChannel.info("尝试重新连接WebSocket...");
    createWebSocket(context, HAS_EXECUTED_KEY);
  }, reconnectInterval);
};

// 启动心跳机制的函数
const startHeartbeat = async (
  ws: any,
  gitUrl: string,
  context: vscode.ExtensionContext,
  HAS_EXECUTED_KEY: string
) => {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  logChannel.info("startHeartbeat", gitUrl);

  // 立即发送一次心跳，确保连接活跃
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      if (gitUrl) {
        ws.send(
          '{"heart":"ping","source":' +
            getEditorTypeCode() +
            ',"gitUrl":"' +
            gitUrl +
            '"}'
        );
      } else {
        ws.send('{"heart":"ping","source":' + getEditorTypeCode() + "}");
      }
      logChannel.info("发送初始心跳消息");
    } catch (error) {
      logChannel.error("发送初始心跳消息失败:", error);
    }
  }

  // 设置定时心跳
  heartbeatIntervalId = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        logChannel.info("appName: " + vscode.env.appName);
        // 发送心跳消息
        if (gitUrl) {
          ws.send(
            '{"heart":"ping","source":' +
              getEditorTypeCode() +
              ',"gitUrl":"' +
              gitUrl +
              '"}'
          );
        } else {
          ws.send('{"heart":"ping","source":' + getEditorTypeCode() + "}");
        }
        logChannel.info("发送心跳消息");
      } catch (error) {
        logChannel.error("发送心跳消息失败:", error);
        // 如果发送失败，清除定时器并尝试重连
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
          heartbeatIntervalId = null;
        }
        closeWebSocket(ws);
        reconnect(context, HAS_EXECUTED_KEY);
      }
    } else {
      logChannel.warn("WebSocket 连接未打开，无法发送心跳");
      // 如果连接未打开，清除定时器
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
      }
    }
  }, heartbeatInterval);
};
