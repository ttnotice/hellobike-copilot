// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from "fs";
import * as vscode from "vscode";
import {
  checkAndPromptInstallExtension,
  checkPluginVersionUpdate,
  checkRemotePluginUpdate,
  detectProjectType,
  findFilesByRegex,
  getEditorTypeCode,
  getProjectPath,
} from "./utils/common";
import {
  HAS_EXECUTED_KEY,
  HAS_LOGIN_KEY,
  JACOCO_DOWNLOAD_URL,
  PLUGIN_ID,
} from "./utils/constants";

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

  // context.subscriptions.push(disposable, logChannel);
  context.subscriptions.push(logChannel);
  // register();

  if (hasExecuted) {
    logChannel.info("hasExecuted", hasExecuted);
    return;
  }

  if (enabled) {
    // 检测插件版本更新
    checkPluginVersionUpdate(context);

    // 检查远程插件更新
    checkRemotePluginUpdate(context);
  }

  context.globalState.update(HAS_EXECUTED_KEY, true).then(() => {
    logChannel.info("Task execution marked in global state");
  });

  // 未覆盖方法视图的"刷新"按钮
  context.subscriptions.push(
    vscode.commands.registerCommand("aegisUncovered.refresh", () => {
      fileSystemProvider.refresh();
    })
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
