// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from "fs";
import * as vscode from "vscode";
import { getUserPromptGroups } from "./utils/aiPlatform";
import { getAppInfo } from "./utils/cmdb";
import { logOut, register, reportActivity } from "./utils/codeGuard";
import {
  checkAndPromptInstallExtension,
  checkPluginVersionUpdate,
  checkRemotePluginUpdate,
  detectProjectType,
  findFilesByRegex,
  getEditorTypeCode,
  getGitInfo,
  getProjectPath,
} from "./utils/common";
import {
  HAS_EXECUTED_KEY,
  HAS_LOGIN_KEY,
  JACOCO_DOWNLOAD_URL,
  PLUGIN_ID,
  SONAR_PWD,
  SONAR_TOKEN_21,
  SONAR_URL,
  SONAR_URL_21,
  SONAR_USER,
} from "./utils/constants";
import { getCursorUserInfo, getUserInfoForLog } from "./utils/cursorUser";
import { createWebSocket, reconnect } from "./utils/webSockerManger";

import { PromptGroupsProvider } from "./promptGroupsProvider";
import { UncoveredMethodsProvider } from "./sideWindow";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

let selectedParam = 2;

/**
 * 比较版本号
 * @param version1 版本号1
 * @param version2 版本号2
 * @returns 1: version1 > version2, 0: 相等, -1: version1 < version2
 */

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // 1. 先读一次初始值
  const cfg = vscode.workspace.getConfiguration("HCopilot");
  let enabled = cfg.get<boolean>("enable", true);
  logChannel.info("HCopilot.enable 初始值:", enabled);
  if (!enabled) {
    // 弹窗提示插件未开启
    vscode.window
      .showInformationMessage(
        "HCopilot 插件未开启，是否立即开启？",
        { modal: false },
        "开启"
      )
      .then(selection => {
        if (selection === "开启") {
          // 更新配置为 true
          cfg.update("enable", true, vscode.ConfigurationTarget.Global).then(
            () => {
              enabled = true;
              logChannel.info("HCopilot.enable 已设置为 true");
              // vscode.window.showInformationMessage("HCopilot 插件已开启");
            },
            error => {
              logChannel.error("更新配置失败:", error);
              vscode.window.showErrorMessage(
                "开启插件失败，请手动在设置中开启"
              );
            }
          );
        }
      });
  }
  // 2. 监听enable配置变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      logChannel.info("配置变化事件:", {
        affectsConfiguration: e.affectsConfiguration("HCopilot.enable"),
        affectsConfigurationNamespace: e.affectsConfiguration("HCopilot"),
      });

      // 只关心我们自己的命名空间，避免无意义刷新
      if (e.affectsConfiguration("HCopilot.enable")) {
        const newValue = vscode.workspace
          .getConfiguration("HCopilot")
          .get<boolean>("enable", true);
        logChannel.info("HCopilot.enable 从", enabled, "改为", newValue);
        enabled = newValue;
        vscode.window.showInformationMessage(
          `HCopilot 已${enabled ? "开启" : "关闭"}`
        );
        if (!enabled) {
          logChannel.info("HCopilot.enable 已关闭, 关闭插件");
          vscode.commands.executeCommand("HCopilot.disable");
          try {
            logOut();
            logChannel.info("插件关闭时已调用 logOut");
          } catch (error: any) {
            logChannel.error("插件关闭时调用 logOut 失败:", error.message);
          }
        } else {
          logChannel.info("插件开启时已调用 createWebSocket");
          // 检测插件版本更新
          checkPluginVersionUpdate(context);
          // 检查远程插件更新
          checkRemotePluginUpdate(context);
          // 创建WebSocket连接
          let ws = createWebSocket(context, HAS_EXECUTED_KEY);
          logChannel.info("ws", ws);
          if (!ws) {
            logChannel.error("ws is null");
            reconnect(context, HAS_EXECUTED_KEY);
          }
        }

        // TODO: 这里做真正的业务刷新 / 重注册 / 重加载
      } else if (e.affectsConfiguration("HCopilot")) {
        // 监听整个命名空间的变化（包括其他配置项）
        logChannel.info("HCopilot 配置发生变化");
      }
    })
  );

  const workspaceFolders = vscode.workspace.workspaceFolders;
  // if (workspaceFolders && workspaceFolders.length > 0) {
  //   const rootUri = workspaceFolders[0].uri;
  //   vscode.workspace.fs.stat(vscode.Uri.joinPath(rootUri, "pom.xml")).then(
  //     () =>
  //       vscode.commands.executeCommand("setContext", "isMavenProject", true),
  //     () =>
  //       vscode.commands.executeCommand("setContext", "isMavenProject", false)
  //   );
  // } else {
  //   vscode.commands.executeCommand("setContext", "isMavenProject", false);
  // }
  detectProjectType(getProjectPath()).then(projectType => {
    if (projectType === "java") {
      vscode.commands.executeCommand("setContext", "isMavenProject", true);
    }
  });

  // 检查全局状态, 判断是否已执行过
  context.globalState.update(HAS_EXECUTED_KEY, false);
  const hasExecuted = context.globalState.get(HAS_EXECUTED_KEY, false);

  context.globalState.update(HAS_LOGIN_KEY, "1");

  // Use the console to output diagnostic information (logChannel.info) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  logChannel.info(
    "Congratulations, your extension " + PLUGIN_ID + " is now active!"
  );

  // 记录用户信息到日志
  getCursorUserInfo()
    .then(userInfo => {
      logChannel.info("Cursor 用户信息:", userInfo);
      logChannel.info("系统用户信息:", getUserInfoForLog());
    })
    .catch(error => {
      logChannel.warn("获取用户信息失败:", error);
    });

  // 插件启动时获取并筛选 type="normal" 的 Prompt Groups 数据
  getUserPromptGroups("normal")
    .then(normalPromptGroups => {
      if (normalPromptGroups) {
        logChannel.info(
          "插件启动时获取到的 type='normal' 的 Prompt Groups:",
          normalPromptGroups
        );

        // 统计筛选后的数据
        const totalGroups = normalPromptGroups.length;
        const totalPrompts = normalPromptGroups.reduce(
          (sum: number, group: any) => {
            return sum + (group.prompts ? group.prompts.length : 0);
          },
          0
        );

        logChannel.info(
          `筛选结果: ${totalGroups} 个组，共 ${totalPrompts} 个 normal 类型的 prompts`
        );

        // 使用状态栏显示筛选结果
        const statusBarItem = vscode.window.createStatusBarItem(
          vscode.StatusBarAlignment.Left,
          1001
        );
        statusBarItem.text = `$(check) 已加载 ${totalPrompts} 个 normal 类型 prompts`;
        statusBarItem.show();

        // 3秒后自动隐藏状态栏消息
        setTimeout(() => {
          statusBarItem.dispose();
        }, 3000);

        // 批量写入 normal 类型的 prompts 到文件
        writeNormalPromptsToFiles(normalPromptGroups);
      } else {
        logChannel.warn(
          "插件启动时未获取到 type='normal' 的 Prompt Groups 数据"
        );
      }
    })
    .catch(error => {
      logChannel.error("插件启动时获取 Prompt Groups 失败:", error);
    });

  const configuration = vscode.workspace.getConfiguration("mcp.server");

  // 获取服务器地址, 如果用户没有设置, 则会返回 package.json 中定义的默认值
  const serverUrl = configuration.get<string>("url");
  const timeout = configuration.get<number>("timeout");

  logChannel.info("MCP Server URL:", serverUrl); // "https://default-mcp-server.example.com/api" (如果用户未修改)
  logChannel.info("MCP Server Timeout:", timeout); // 15000 (如果用户未修改)

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  // const disposable = vscode.commands.registerCommand(
  //   "hello-copilot.helloWorld",
  //   () => {
  // The code you place here will be executed every time your command is executed
  // Display a message box to the user
  // vscode.window.showInformationMessage("Hello World from hello-copilot!");
  // vscode.window.showInformationMessage(
  //   "modal Hello World from hello-copilot!",
  //   {
  //     modal: true,
  //   }
  // );
  // vscode.window.showInformationMessage(
  //   "n Hello World from\n\n hello-copilot!"
  // );
  // vscode.window.showInformationMessage(
  //   "br Hello World from  <br><br>hello-copilot!"
  // );
  // vscode.window.showInformationMessage(
  //   "__italic__ **bolded** Hello World from\n\n [hello-copilot](htttp://www.qq.com)"
  // );
  // const header = "Message Header";
  // const options: vscode.MessageOptions = {
  //   detail: "Message Description[hello-copilot](htttp://www.qq.com)",
  //   modal: true,
  // };
  // vscode.window
  //   .showInformationMessage(header, options, ...["Ok"])
  //   .then((item) => {
  //     console.log(item);
  //   });
  // vscode.window
  //   .showInformationMessage(
  //     "请选择要打开的网页",
  //     { modal: true, detail: "更多信息" },
  //     { title: "Retry" },
  //     { title: "Open Log" }
  //   )
  //   .then((result) => {
  //     console.log(`result: ${result.title}`);
  //   });
  // vscode.window.setStatusBarMessage("cmd: extdev.showMsgbox", 3000);
  //   }
  // );

  // 1. 创建并注册我们的 TreeDataProvider
  const fileSystemProvider = new UncoveredMethodsProvider();
  vscode.window.registerTreeDataProvider(
    "myProjectExplorer",
    fileSystemProvider
  );

  // 2. 创建并注册 Prompt Groups TreeDataProvider
  const promptGroupsProvider = new PromptGroupsProvider(context);
  vscode.window.registerTreeDataProvider("promptGroups", promptGroupsProvider);

  // "My Project" 视图标题栏的"选择参数"按钮
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "myProjectExplorer.selectParam",
      async () => {
        const options = Array.from({ length: 9 }, (_, i) => (i + 2).toString());
        const picked = await vscode.window.showQuickPick(options, {
          placeHolder: "请选择版本个数",
        });
        if (picked) {
          selectedParam = parseInt(picked, 10);
          fileSystemProvider.setParam(selectedParam);
          // vscode.window.showInformationMessage(`已选择参数: ${selectedParam}`);
        }
      }
    )
  );

  // "My Project" 视图树中点击文件项时打开文件
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "myProjectExplorer.openFile",
      (resourceUri: vscode.Uri) => {
        // 当命令被触发时, 使用 VS Code 的 API 打开文件
        vscode.window.showTextDocument(resourceUri);
      }
    )
  );

  // "My Project" 视图标题栏的"刷新"按钮
  context.subscriptions.push(
    vscode.commands.registerCommand("myProjectExplorer.refresh", () => {
      // 这个功能需要你在 FileSystemProvider 中实现 onDidChangeTreeData 事件
      // 为了简化, 这里暂时不实现, 但这是完整插件的必备功能
      vscode.window.showInformationMessage(
        "Refresh functionality not implemented in this example."
      );
      fileSystemProvider.refresh();
    })
  );

  // "Prompt Groups" 视图标题栏的"刷新"按钮
  context.subscriptions.push(
    vscode.commands.registerCommand("promptGroups.refresh", () => {
      promptGroupsProvider.refresh();
    })
  );

  // Prompt Groups 视图中点击 prompt 项时显示内容
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "promptGroups.showPrompt",
      (prompt: any) => {
        // 显示 prompt 内容
        const panel = vscode.window.createWebviewPanel(
          "promptContent",
          `Prompt: ${prompt.name}`,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        // 设置 webview 内容
        panel.webview.html = getWebviewContent(prompt);
      }
    )
  );

  // "Prompt Groups" 视图项右键菜单的"更新到 Rules 文件"按钮
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "promptGroups.updateToRules",
      async (node: any) => {
        try {
          reportActivity(16, node.parentGroup);
          logChannel.info("node parentGroup:", node);
          // 从树节点获取 prompt 数据
          let prompt: any;

          if (node && node.prompt) {
            // 如果直接传递了 prompt 数据
            prompt = node.prompt;
          } else if (node && typeof node === "object" && node.name) {
            // 如果传递的就是 prompt 对象
            prompt = node;
          } else if (node && node.resourceUri) {
            // 从 resourceUri 中提取 prompt ID
            const uriString = node.resourceUri.toString();
            const match = uriString.match(/prompt:\/\/(.+)/);
            if (match && match[1]) {
              prompt = promptGroupsProvider.getPromptById(match[1]);
            }
          }

          if (!prompt) {
            vscode.window.showErrorMessage("无法获取 Prompt 数据");
            logChannel.error("无法获取 Prompt 数据, 节点信息:", node);
            return;
          }

          logChannel.info("更新 Rules 文件, Prompt 数据:", prompt);

          // 获取当前工作区路径
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("请先打开一个工作区");
            return;
          }

          // 构建文件路径
          const rulesDir =
            getEditorTypeCode() === 2
              ? vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules")
              : vscode.Uri.joinPath(workspaceFolder.uri, ".kiro", "steering");
          const fileName = `${prompt.name}${
            getEditorTypeCode() === 2 ? ".mdc" : ".md"
          }`;
          const fileUri = vscode.Uri.joinPath(rulesDir, fileName);

          // 确保 .cursor/rules 目录存在
          try {
            await vscode.workspace.fs.stat(rulesDir);
          } catch (error) {
            // 目录不存在, 创建它
            await vscode.workspace.fs.createDirectory(rulesDir);
          }

          // 构建文件内容
          const fileContent = `# ${prompt.name}

${prompt.description ? `> ${prompt.description}` : ""}

${prompt.content}`;

          // 写入文件
          const encoder = new TextEncoder();
          await vscode.workspace.fs.writeFile(
            fileUri,
            encoder.encode(fileContent)
          );

          // 显示成功消息
          vscode.window
            .showInformationMessage(
              `Prompt "${prompt.name}" 已成功更新到 ${fileName}`,
              "打开文件"
            )
            .then(selection => {
              if (selection === "打开文件") {
                vscode.window.showTextDocument(fileUri);
              }
            });

          logChannel.info(
            `Prompt "${prompt.name}" 已写入到: ${fileUri.fsPath}`
          );
        } catch (error: any) {
          logChannel.error("更新 Rules 文件失败:", error);
          vscode.window.showErrorMessage(
            `更新 Rules 文件失败: ${error.message}`
          );
        }
      }
    )
  );

  // context.subscriptions.push(disposable, logChannel);
  context.subscriptions.push(logChannel);
  register();

  if (hasExecuted) {
    logChannel.info("hasExecuted", hasExecuted);
    return;
  }

  if (enabled) {
    // 检测插件版本更新
    checkPluginVersionUpdate(context);

    // 检查远程插件更新
    checkRemotePluginUpdate(context);
    // 创建WebSocket连接
    let ws = createWebSocket(context, HAS_EXECUTED_KEY);
    logChannel.info("ws", ws);
    if (!ws) {
      logChannel.error("ws is null");
      reconnect(context, HAS_EXECUTED_KEY);
    }
  }

  // 监听VSCode窗口关闭事件, 关闭WebSocket连接
  // vscode.window.onDidChangeWindowState((state) => {
  //   if (!state.focused) {
  //     closeWebSocket(ws);
  //     context.globalState.update("myExtension.hasExecutedTask", false);
  //   }
  // });

  context.globalState.update(HAS_EXECUTED_KEY, true).then(() => {
    logChannel.info("Task execution marked in global state");
  });

  // 未覆盖方法视图的"刷新"按钮
  context.subscriptions.push(
    vscode.commands.registerCommand("aegisUncovered.refresh", () => {
      fileSystemProvider.refresh();
    })
  );

  // 文件资源管理器右键菜单的"sonar上报"按钮（仅在 Maven 项目中显示）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "hello-copilot.sonarAction",
      async (uri: vscode.Uri) => {
        vscode.window.showInformationMessage(
          `开始执行 Sonar 上报: ${uri.fsPath}`
        );

        let projectPath = getProjectPath();
        logChannel.info("Project path:", projectPath);

        // 检查是否为Maven项目
        if (!fs.existsSync(projectPath + "/pom.xml")) {
          vscode.window.showWarningMessage("非Maven项目无法执行!");
          return;
        }

        try {
          // 获取Git信息
          let gitInfo = await getGitInfo(projectPath);
          let appIdTmp = gitInfo.remote;

          if (!appIdTmp) {
            vscode.window.showErrorMessage("无法获取Git远程仓库信息！");
            return;
          }

          const lastSlash = appIdTmp.lastIndexOf("/");
          const dotGit = appIdTmp.lastIndexOf(".git");
          const appId = appIdTmp.substring(lastSlash + 1, dotGit);

          logChannel.info("App ID:", appId);
          vscode.window.showInformationMessage(`检测到应用: ${appId}`);

          // 获取应用信息
          let appInfo = await getAppInfo(appId);
          logChannel.info("no:", appInfo);

          // 构建Sonar命令
          const SONAR_CMD = [
            `mvn org.sonarsource.scanner.maven:sonar-maven-plugin:3.11.0.3922:sonar`,
            `-Dsonar.host.url=${SONAR_URL}`,
            `-Dsonar.login=${SONAR_USER}`,
            `-Dsonar.password=${SONAR_PWD}`,
            `-Dsonar.coverage.jacoco.xmlReportPaths=./target/jacoco-all.xml`,
            `-Dsonar.projectName=${appId}`,
            `-Dsonar.projectKey=${appId}`,
            `-Dsonar.branch.name=%s`,
            `-Dsonar.projectVersion=%s`,
            `-Dsonar.analysis.commitHash=%s`,
          ].join(" ");

          const SONAR_CMD_21 = [
            `mvn sonar:sonar`,
            `-Dsonar.host.url=${SONAR_URL_21}`,
            `-Dsonar.token=${SONAR_TOKEN_21}`,
            `-Dsonar.coverage.jacoco.xmlReportPaths=./target/jacoco-all.xml`,
            `-Dsonar.projectName=${appId}`,
            `-Dsonar.projectKey=${appId}`,
            `-Dsonar.branch.name=%s`,
            `-Dsonar.analysis.commitHash=%s`,
          ].join(" ");

          logChannel.info("Sonar Command (Legacy):", SONAR_CMD);
          logChannel.info("Sonar Command (v2.1):", SONAR_CMD_21);

          // 创建进度通知
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "执行Sonar代码质量分析",
              cancellable: false,
            },
            async progress => {
              progress.report({ message: "正在执行Sonar分析..." });

              // 1. 创建ShellExecution
              const shellExec = new vscode.ShellExecution(SONAR_CMD_21, {
                cwd: projectPath,
              });

              // 2. 创建Task
              const task = new vscode.Task(
                { type: "shell" },
                vscode.TaskScope.Workspace,
                "Sonar Code Quality Analysis",
                "hello-copilot",
                shellExec
              );

              // 3. 监听任务结束事件
              const disposable = vscode.tasks.onDidEndTaskProcess(e => {
                if (e.execution.task === task) {
                  if (e.exitCode === 0) {
                    progress.report({
                      message: "Sonar分析完成, 正在生成报告...",
                    });

                    vscode.window.showInformationMessage(
                      "Sonar代码质量分析完成！"
                    );
                    logChannel.info("Sonar analysis completed successfully");

                    // 可以在这里添加更多的结果处理逻辑
                    // 比如检查生成的报告文件, 或者打开SonarQube页面等
                  } else {
                    vscode.window.showErrorMessage(
                      `Sonar分析失败, 退出码：${e.exitCode}`
                    );
                    logChannel.error(
                      "Sonar analysis failed with exit code:",
                      e.exitCode
                    );
                  }
                  disposable.dispose();
                }
              });

              // 4. 启动任务
              vscode.tasks.executeTask(task);
            }
          );
        } catch (error: any) {
          logChannel.error("Sonar Action error:", error);
          vscode.window.showErrorMessage(
            `执行Sonar分析时发生错误: ${error.message}`
          );
        }
      }
    )
  );

  // 文件资源管理器右键菜单的"执行单测"按钮（仅在 Maven 项目中显示）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "hello-copilot.utAction",
      async (uri: vscode.Uri) => {
        let checkResult = checkAndPromptInstallExtension(
          "ryanluker.vscode-coverage-gutters"
        );
        if (!checkResult) {
          return;
        }
        vscode.window.showInformationMessage(`开始执行单元测试: ${uri.fsPath}`);

        let projectPath = getProjectPath();
        logChannel.info("Project path:", projectPath);

        // 检查是否为Maven项目
        if (!fs.existsSync(projectPath + "/pom.xml")) {
          vscode.window.showWarningMessage("非Maven项目无法执行!");
          return;
        }

        try {
          // 获取Git信息
          let gitInfo = await getGitInfo(projectPath);
          let appIdTmp = gitInfo.remote;

          if (!appIdTmp) {
            vscode.window.showErrorMessage("无法获取Git远程仓库信息！");
            return;
          }
          const lastSlash = appIdTmp.lastIndexOf("/");
          const dotGit = appIdTmp.lastIndexOf(".git");
          const appId = appIdTmp.substring(lastSlash + 1, dotGit);

          logChannel.info("App ID:", appId);
          vscode.window.showInformationMessage(`检测到应用: ${appId}`);

          // 获取应用信息
          let appInfo = await getAppInfo(appId);
          logChannel.info("App Info:", appInfo);

          let env = "fat";

          // 构建单元测试命令
          const UT_COMMAND = [
            "mvn clean",
            `curl -L -o jacococli.jar '${JACOCO_DOWNLOAD_URL}'`,
            `mvn -Djacoco.destFile=./target/jacoco.exec -Djacoco:append=true org.jacoco:jacoco-maven-plugin:prepare-agent -Dmaven.test.failure.ignore=true package -Denv=${env} -DAPPID=${appId} -DskipTests=false -DfailIfNoTests=false -Dmaven.javadoc.skip=true`,
            "java -jar jacococli.jar merge $(find ./ -name jacoco.exec | tr '\\n' ' ') --destfile ./target/jacoco-all.exec",
            "java -jar jacococli.jar report ./target/jacoco-all.exec --xml ./target/jacoco-all.xml --html ./target/coverageReport --encoding=utf-8 $(find \"$(readlink -f .)\" -type d -path '*/target/classes' | awk '{printf \"--classfiles %s \", $0}') $(find \"$(readlink -f .)\" -type d -path '*/src/main/java' | awk '{printf \"--sourcefiles %s \", $0}')",
            "java -jar jacococli.jar report ./target/jacoco-all.exec --xml ./target/jacoco-all.xml --html ./target/dc/coverageReport --encoding=utf-8 $(find \"$(readlink -f .)\" -type d -path '*/target/classes' | awk '{printf \"--classfiles %s \", $0}') $(find \"$(readlink -f .)\" -type d -path '*/src/main/java' | awk '{printf \"--sourcefiles %s \", $0}')",
            "(rm -fr jacococli.jar || true)",
          ].join(" && ");

          logChannel.info("UT Command:", UT_COMMAND);

          // 创建进度通知
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "执行单元测试",
              cancellable: false,
            },
            async progress => {
              progress.report({ message: "正在执行Maven测试..." });

              // 1. 创建ShellExecution
              const shellExec = new vscode.ShellExecution(UT_COMMAND, {
                cwd: projectPath,
              });

              // 2. 创建Task
              const task = new vscode.Task(
                { type: "shell" },
                vscode.TaskScope.Workspace,
                "Unit Test Execution",
                "hello-copilot",
                shellExec
              );

              // 3. 监听任务结束事件
              const disposable = vscode.tasks.onDidEndTaskProcess(e => {
                if (e.execution.task === task) {
                  if (e.exitCode === 0) {
                    progress.report({
                      message: "测试执行完成, 正在生成覆盖率报告...",
                    });

                    // 检查生成的文件
                    const execFileUri = vscode.Uri.file(
                      projectPath + "/target/jacoco-all.exec"
                    );
                    const xmlFileUri = vscode.Uri.file(
                      projectPath + "/target/jacoco-all.xml"
                    );

                    Promise.all([
                      Promise.resolve(fs.existsSync(execFileUri.fsPath)),
                      Promise.resolve(fs.existsSync(xmlFileUri.fsPath)),
                    ]).then(([execExists, xmlExists]) => {
                      if (execExists && xmlExists) {
                        vscode.window.showInformationMessage(
                          "单元测试执行成功！覆盖率报告已生成。"
                        );
                        logChannel.info("UT execution completed successfully");
                      } else {
                        vscode.window.showWarningMessage(
                          "测试执行完成, 但覆盖率报告文件可能不完整。"
                        );
                        logChannel.warn(
                          "UT execution completed but coverage files may be incomplete"
                        );
                      }
                    });
                  } else {
                    vscode.window.showErrorMessage(
                      `单元测试执行失败, 退出码：${e.exitCode}`
                    );
                    logChannel.error(
                      "UT execution failed with exit code:",
                      e.exitCode
                    );
                  }
                  disposable.dispose();
                }
              });

              // 4. 启动任务
              vscode.tasks.executeTask(task);
            }
          );
        } catch (error: any) {
          logChannel.error("UT Action error:", error);
          vscode.window.showErrorMessage(
            `执行单元测试时发生错误: ${error.message}`
          );
        }
      }
    )
  );

  // 未覆盖方法视图中点击方法项时打开文件并跳转到方法
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "aegisUncovered.openFile",
      async (packageName: string, className: string, methodName: string) => {
        logChannel.info(
          `Command triggered: aegisUncovered.openFile with args: ${packageName}, ${className}, ${methodName}`
        );

        // Convert package name to a file path segment
        const packagePath = packageName.replace(/\./g, "/");
        // Create a precise glob pattern to find the file
        const globPattern = `**/${packagePath}/${className}.java`;

        const files = await vscode.workspace.findFiles(
          globPattern,
          "**/target/**"
        );

        if (files.length > 0) {
          const document = await vscode.workspace.openTextDocument(files[0]);
          const editor = await vscode.window.showTextDocument(document);

          // Try to find the method definition in the opened file
          const text = document.getText();
          // Extract the method name from the signature (e.g., "getCarGuideUrl()" -> "getCarGuideUrl")
          const simpleMethodName = methodName.split("(")[0];
          const methodRegex = new RegExp(
            `(public|private|protected|static|\\s) +[\\w\\<\\>\\[\\]]+\\s+(${simpleMethodName})\\s*\\(`
          );
          const match = text.match(methodRegex);

          if (match && match.index) {
            const position = document.positionAt(match.index);
            // Select the method name and scroll to it
            const selection = new vscode.Selection(
              position,
              document.positionAt(match.index + match[0].length)
            );
            editor.selection = selection;
            editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
          }
        } else {
          vscode.window.showWarningMessage(
            `Could not find file for class: ${className}.java`
          );
        }
      }
    )
  );
}

// 生成 webview 内容的函数
function getWebviewContent(prompt: any): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt 内容</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 1.2em;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 5px;
        }
        .description {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .content {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.5;
        }
        .copy-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }
        .copy-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${prompt.name || "未命名 Prompt"}</div>
        ${
          prompt.description
            ? `<div class="description">${prompt.description}</div>`
            : ""
        }
    </div>
    
    <div class="content" id="promptContent">${
      prompt.content || "暂无内容"
    }</div>
    
    <button class="copy-btn" onclick="copyToClipboard()">复制内容</button>
    
    <script>
        function copyToClipboard() {
            const content = document.getElementById('promptContent').textContent;
            navigator.clipboard.writeText(content).then(() => {
                // 可以添加复制成功的提示
                console.log('内容已复制到剪贴板');
            }).catch(err => {
                console.error('复制失败:', err);
            });
        }
    </script>
</body>
</html>`;
}

// 批量写入 normal 类型的 prompts 到文件
async function writeNormalPromptsToFiles(normalPromptGroups: any[]) {
  try {
    // 获取当前工作区路径
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      logChannel.warn("请先打开一个工作区，无法写入 normal prompts 文件");
      return;
    }

    // 构建文件路径
    const rulesDir =
      getEditorTypeCode() === 2
        ? vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules")
        : vscode.Uri.joinPath(workspaceFolder.uri, ".kiro", "steering");

    // 确保 .cursor/rules 目录存在
    try {
      await vscode.workspace.fs.stat(rulesDir);
    } catch (error) {
      // 目录不存在, 创建它
      await vscode.workspace.fs.createDirectory(rulesDir);
      logChannel.info("创建 .cursor/rules 目录");
    }

    // 统计要写入的 prompts 数量
    const totalPrompts = normalPromptGroups.reduce(
      (sum: number, group: any) => {
        return sum + (group.prompts ? group.prompts.length : 0);
      },
      0
    );

    if (totalPrompts === 0) {
      logChannel.info("没有 normal 类型的 prompts 需要写入");
      return;
    }

    // 显示进度通知
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "正在写入 normal 类型 prompts 到文件",
        cancellable: false,
      },
      async progress => {
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        // 遍历所有组和 prompts
        for (const group of normalPromptGroups) {
          if (!group.prompts || !Array.isArray(group.prompts)) {
            continue;
          }
          logChannel.warn("normalPromptGroups", group);
          reportActivity(16, group);

          for (const prompt of group.prompts) {
            try {
              // 更新进度
              progress.report({
                message: `正在写入: ${prompt.name}`,
                increment: 100 / totalPrompts,
              });

              // 构建文件名，不包含组名
              const fileName = `${prompt.name}${
                getEditorTypeCode() === 2 ? ".mdc" : ".md"
              }`;
              const fileUri = vscode.Uri.joinPath(rulesDir, fileName);

              // 查找并删除同名的旧文件
              try {
                const oldFiles = await findFilesByRegex(
                  rulesDir.fsPath,
                  new RegExp(
                    `${prompt.name}_\\d+\\${
                      getEditorTypeCode() === 2 ? ".mdc" : ".md"
                    }$`
                  )
                );

                for (const oldFilePath of oldFiles) {
                  try {
                    await vscode.workspace.fs.delete(
                      vscode.Uri.file(oldFilePath)
                    );
                    logChannel.info(`已删除旧文件: ${oldFilePath}`);
                  } catch (deleteError) {
                    logChannel.warn(
                      `删除旧文件失败: ${oldFilePath}`,
                      deleteError
                    );
                  }
                }
              } catch (findError) {
                logChannel.warn(`查找旧文件失败: ${prompt.name}`, findError);
              }

              // 构建文件内容
              const fileContent = `${prompt.content}`;

              // 写入文件
              const encoder = new TextEncoder();
              await vscode.workspace.fs.writeFile(
                fileUri,
                encoder.encode(fileContent)
              );

              logChannel.info(`已写入 normal prompt: ${fileName}`);
              successCount++;
            } catch (error: any) {
              logChannel.error(`写入 prompt "${prompt.name}" 失败:`, error);
              errorCount++;
            }

            processedCount++;
          }
        }

        // 显示完成消息
        if (successCount > 0) {
          const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            1002
          );
          statusBarItem.text = `$(check) 已写入 ${successCount} 个 normal prompts 到 .cursor/rules/`;
          statusBarItem.show();

          // 5秒后自动隐藏状态栏消息
          setTimeout(() => {
            statusBarItem.dispose();
          }, 5000);

          logChannel.info(
            `批量写入完成: 成功 ${successCount} 个，失败 ${errorCount} 个`
          );
        }

        if (errorCount > 0) {
          vscode.window.showWarningMessage(
            `写入 normal prompts 时发生 ${errorCount} 个错误，请查看日志了解详情`
          );
        }
      }
    );
  } catch (error: any) {
    logChannel.error("批量写入 normal prompts 失败:", error);
    vscode.window.showErrorMessage(
      `批量写入 normal prompts 失败: ${error.message}`
    );
  }
}
