import axios from "axios";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { getConfig, reportActivity } from "./codeGuard";
import {
  AEGIS_WEB_URL,
  CURSOR_RULES_DIR,
  DINGTALK_CLIENT_ID,
  HAS_LOGIN_KEY,
  KIRO_RULES_DIR,
  PLUGIN_ID,
  PLUGIN_VERSION,
} from "./constants";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

export const getGitUserConfig = async () => {
  try {
    const extension = vscode.extensions.getExtension("vscode.git");
    if (!extension) {
      throw new Error("Git extension not found");
    }

    const gitExtension = extension.isActive
      ? extension.exports
      : await extension.activate();
    const git = gitExtension.getAPI(1);

    // 获取第一个仓库（如果有多个仓库，需要遍历）
    const repository = git.repositories[0];
    if (!repository) {
      throw new Error("No Git repository found");
    }

    // 获取配置
    const name = await repository.getConfig("user.name");
    const email = await repository.getConfig("user.email");

    return { name, email };
  } catch (error) {
    logChannel.error("Failed to get Git config:", error);
    return { name: undefined, email: undefined };
  }
};

export const getGitUserConfigFromCommand = async () => {
  try {
    // 获取用户名
    const name = childProcess
      .execSync("git config --global user.name")
      .toString()
      .trim();
    // 获取邮箱
    const email = childProcess
      .execSync("git config --global user.email")
      .toString()
      .trim();
    return { name, email };
  } catch (error) {
    logChannel.error("Failed to execute Git command:", error);
    return { name: undefined, email: undefined };
  }
};

export const getPluginInfo = async () => {
  // logChannel.info("123 getPluginInfo", vscode.extensions);

  // 获取所有已安装的扩展(插件)
  // const allExtensions = vscode.extensions.all;

  // 打印每个插件的信息
  // allExtensions.forEach((extension) => {
  //   if (logChannel) {
  //     logChannel.info("---");
  //     logChannel.info("插件ID:", extension.id);
  //     logChannel.info("插件名称:", extension.packageJSON.displayName || extension.id);
  //     logChannel.info("版本:", extension.packageJSON.version);
  //     logChannel.info("发布者:", extension.packageJSON.publisher);
  //     logChannel.info("激活状态:", extension.isActive ? "已激活" : "未激活");
  //     logChannel.info("描述:", extension.packageJSON.description);
  //   } else {
  //     console.log("---");
  //     console.log("插件ID:", extension.id);
  //     console.log("插件名称:", extension.packageJSON.displayName || extension.id);
  //     console.log("版本:", extension.packageJSON.version);
  //     console.log("发布者:", extension.packageJSON.publisher);
  //     console.log("激活状态:", extension.isActive ? "已激活" : "未激活");
  //     console.log("描述:", extension.packageJSON.description);
  //   }
  // });

  const extension = vscode.extensions.getExtension(PLUGIN_ID);
  if (extension) {
    const extensionVersion = extension.packageJSON.version;
    logChannel.info(`插件版本: ${extensionVersion}`);
    return extension.packageJSON;
  }
};

export const getGitInfo = async (workspacePath: string) => {
  let remote = "",
    branch = null,
    hash = null;
  try {
    remote = childProcess
      .execSync("git config --get remote.origin.url", { cwd: workspacePath })
      .toString()
      .trim();
  } catch (e) {
    // 忽略错误
  }

  try {
    branch = childProcess
      .execSync("git rev-parse --abbrev-ref HEAD", { cwd: workspacePath })
      .toString()
      .trim();
  } catch (e) {
    // 忽略错误
  }

  try {
    hash = childProcess
      .execSync("git rev-parse HEAD", { cwd: workspacePath })
      .toString()
      .trim();
  } catch (e) {
    // 忽略错误
  }

  return { remote: normalizeRemoteUrl(remote), branch, hash };
};


// 1. ssh://git@gitlab.hellobike.cn:10022/CoolTest/AppCooltestApiReplayWeb.git 
// 2. https://gitlab.hellobike.cn/fund/AppFinancePaymentService
// 有些人的git返回remote是第二种格式，统一处理成第一种格式，后端用的是第一种格式
const normalizeRemoteUrl = (remote: string): string => {
  if (remote.startsWith("https://gitlab.hellobike.cn")) {
    remote = remote.replace("https://gitlab.hellobike.cn", "ssh://git@gitlab.hellobike.cn:10022");
    if (!remote.endsWith(".git")) {
      remote = remote + ".git";
    }
  }
  return remote;
};

export const getProjectPath = (): string => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  return "";
};

/**
 * 获取当前 Cursor 中所有定义的 rules
 * 包括工作区配置、用户配置和默认配置中的规则
 */
export const getCursorRules = async (): Promise<{
  workspaceRules: any;
  userRules: any;
  defaultRules: any;
  allRules: any;
}> => {
  try {
    // 获取工作区配置中的规则
    const workspaceRules = vscode.workspace.getConfiguration();

    // 获取用户配置中的规则
    const userRules = vscode.workspace.getConfiguration(undefined, undefined);

    // 获取默认配置中的规则
    const defaultRules = vscode.workspace.getConfiguration(
      undefined,
      vscode.ConfigurationTarget.Global as any
    );

    // 合并所有规则
    const allRules = {
      workspace: workspaceRules,
      user: userRules,
      default: defaultRules,
    };

    logChannel.info("获取到的 Cursor Rules:", {
      workspaceRules: Object.keys(workspaceRules),
      userRules: Object.keys(userRules),
      defaultRules: Object.keys(defaultRules),
    });

    return {
      workspaceRules,
      userRules,
      defaultRules,
      allRules,
    };
  } catch (error) {
    logChannel.error("获取 Cursor Rules 失败:", error);
    vscode.window.showErrorMessage("获取 Cursor Rules 时发生错误");

    return {
      workspaceRules: {},
      userRules: {},
      defaultRules: {},
      allRules: {},
    };
  }
};

/**
 * 获取特定配置项的规则值
 * @param section 配置节名称，例如 "editor"、"files" 等
 * @param defaultValue 默认值
 */
export const getCursorRuleValue = <T>(section: string, defaultValue?: T): T => {
  try {
    const config = vscode.workspace.getConfiguration(section);
    return config.get<T>(section, defaultValue as T);
  } catch (error) {
    logChannel.error(`获取配置项 ${section} 失败:`, error);
    return defaultValue as T;
  }
};

/**
 * 获取工作区特定的规则配置
 * @param section 配置节名称
 */
export const getWorkspaceSpecificRules = (section?: string) => {
  try {
    if (section) {
      return vscode.workspace.getConfiguration(section);
    } else {
      return vscode.workspace.getConfiguration();
    }
  } catch (error) {
    logChannel.error("获取工作区特定规则失败:", error);
    return {};
  }
};

/**
 * 读取指定规则集的指定标题下的内容，并与输入内容做对比，若不一样则覆写
 * @param section 配置节名称，例如 "editor"、"files" 等
 * @param key 配置项键名，例如 "fontSize"、"tabSize" 等
 * @param newValue 新的配置值
 * @param target 配置目标，默认为工作区级别
 * @returns 返回更新结果信息
 */
export const updateCursorRuleIfDifferent = async <T>(
  section: string,
  key: string,
  newValue: T,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
): Promise<{
  success: boolean;
  message: string;
  oldValue?: T;
  newValue?: T;
}> => {
  try {
    const config = vscode.workspace.getConfiguration(section);
    const currentValue = config.get<T>(key);

    // 检查值是否不同
    if (JSON.stringify(currentValue) !== JSON.stringify(newValue)) {
      // 更新配置
      await config.update(key, newValue, target);

      // 验证更新是否成功
      const updatedValue = config.get<T>(key);
      if (JSON.stringify(updatedValue) === JSON.stringify(newValue)) {
        logChannel.info(`配置项 ${section}.${key} 已成功更新:`, {
          oldValue: currentValue,
          newValue: newValue,
        });
        return {
          success: true,
          message: `配置项 ${section}.${key} 更新成功`,
          oldValue: currentValue,
          newValue: newValue,
        };
      } else {
        logChannel.error(`配置项 ${section}.${key} 更新失败，更新后的值不匹配`);
        return {
          success: false,
          message: `配置项 ${section}.${key} 更新失败，更新后的值不匹配`,
          oldValue: currentValue,
          newValue: updatedValue,
        };
      }
    } else {
      logChannel.info(`配置项 ${section}.${key} 无需更新，值已是最新的`);
      return {
        success: true,
        message: `配置项 ${section}.${key} 无需更新，值已是最新的`,
        oldValue: currentValue,
        newValue: newValue,
      };
    }
  } catch (error) {
    logChannel.error(`更新配置项 ${section}.${key} 时发生错误:`, error);
    return {
      success: false,
      message: `更新配置项 ${section}.${key} 时发生错误: ${error}`,
    };
  }
};

/**
 * 批量更新多个配置项
 * @param updates 更新配置数组
 * @param target 配置目标，默认为工作区级别
 * @returns 返回更新结果摘要
 */
export const batchUpdateCursorRules = async (
  updates: Array<{
    section: string;
    key: string;
    value: any;
  }>,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{
    section: string;
    key: string;
    success: boolean;
    message: string;
  }>;
}> => {
  const results: Array<{
    section: string;
    key: string;
    success: boolean;
    message: string;
  }> = [];

  for (const update of updates) {
    try {
      const result = await updateCursorRuleIfDifferent(
        update.section,
        update.key,
        update.value,
        target
      );
      results.push({
        section: update.section,
        key: update.key,
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      logChannel.error(
        `批量更新配置项 ${update.section}.${update.key} 时发生错误:`,
        error
      );
      results.push({
        section: update.section,
        key: update.key,
        success: false,
        message: `批量更新配置项 ${update.section}.${update.key} 时发生错误: ${error}`,
      });
    }
  }

  const summary = {
    total: updates.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };

  logChannel.info("批量更新完成:", summary);
  return summary;
};

/**
 * 读取指定规则集的指定标题下的内容
 * @param section 配置节名称，例如 "editor"、"files" 等
 * @param key 配置项键名，例如 "fontSize"、"tabSize" 等
 * @param defaultValue 默认值
 * @returns 返回配置值
 */
export const readCursorRule = <T>(
  section: string,
  key: string,
  defaultValue: T
): T | undefined => {
  try {
    const config = vscode.workspace.getConfiguration(section);
    return config.get<T>(key, defaultValue);
  } catch (error) {
    logChannel.error(`读取配置项 ${section}.${key} 失败:`, error);
    return defaultValue;
  }
};

/**
 * 确保文件存在，如果不存在则创建
 * @param filePath 文件路径
 * @param createDirectory 是否创建目录，默认为 true
 * @param content 文件内容，默认为空字符串
 * @returns 返回操作结果
 */
export const ensureFileExists = async (
  filePath: string,
  createDirectory: boolean = true,
  content: string = "",
  append: boolean = true
): Promise<{
  success: boolean;
  message: string;
  existed: boolean;
}> => {
  try {
    // 检查文件是否已存在
    const fileExists = fs.existsSync(filePath);
    logChannel.info(
      `filePath: ${filePath} createDirectory: ${createDirectory} content: ${content} append: ${append}`
    );
    if (fileExists && !append) {
      logChannel.info(`文件已存在: ${filePath}`);
      return {
        success: true,
        message: `文件已存在: ${filePath}`,
        existed: true,
      };
    }

    if (!fileExists && append) {
      logChannel.error(`文件不存在: ${filePath}`);
      return {
        success: true,
        message: `文件不存在: ${filePath}`,
        existed: true,
      };
    }

    // 如果需要创建目录
    if (createDirectory) {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          logChannel.info(`目录已创建: ${dirPath}`);
        } catch (dirError) {
          logChannel.warn(`创建目录失败，可能已存在: ${dirPath}`, dirError);
        }
      }
    }

    // 写入或追加文件内容
    try {
      if (append && fileExists) {
        // 追加模式：文件已存在，追加内容到文件尾部
        fs.appendFileSync(filePath, content, "utf8");
        logChannel.info(
          `文件内容已追加: ${filePath} content: ${content} append: ${append}`
        );
        return {
          success: true,
          message: `文件内容已追加: ${filePath}`,
          existed: true,
        };
      } else {
        // 覆盖模式：创建新文件或覆盖已存在的文件
        fs.writeFileSync(filePath, content, "utf8");
        logChannel.info(
          `文件已${
            fileExists ? "覆盖" : "创建"
          }: ${filePath} content: ${content} append: ${append}`
        );
        return {
          success: true,
          message: `文件已${fileExists ? "覆盖" : "创建"}: ${filePath}`,
          existed: fileExists,
        };
      }
    } catch (writeError) {
      logChannel.error(`写入文件失败: ${filePath}`, writeError);
      return {
        success: false,
        message: `写入文件失败: ${filePath} - ${writeError}`,
        existed: fileExists,
      };
    }
  } catch (error) {
    logChannel.error(`确保文件存在时发生错误: ${filePath}`, error);
    return {
      success: false,
      message: `确保文件存在时发生错误: ${filePath} - ${error}`,
      existed: false,
    };
  }
};

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 * @returns 返回操作结果
 */
export const ensureDirectoryExists = async (
  dirPath: string
): Promise<{
  success: boolean;
  message: string;
  existed: boolean;
}> => {
  try {
    // 检查目录是否已存在
    if (fs.existsSync(dirPath)) {
      logChannel.info(`目录已存在: ${dirPath}`);
      return {
        success: true,
        message: `目录已存在: ${dirPath}`,
        existed: true,
      };
    }

    // 创建目录
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      logChannel.info(`目录已创建: ${dirPath}`);
      return {
        success: true,
        message: `目录已创建: ${dirPath}`,
        existed: false,
      };
    } catch (createError) {
      logChannel.error(`创建目录失败: ${dirPath}`, createError);
      return {
        success: false,
        message: `创建目录失败: ${dirPath} - ${createError}`,
        existed: false,
      };
    }
  } catch (error) {
    logChannel.error(`确保目录存在时发生错误: ${dirPath}`, error);
    return {
      success: false,
      message: `确保目录存在时发生错误: ${dirPath} - ${error}`,
      existed: false,
    };
  }
};

/**
 * 根据正则表达式查找文件
 * @param folderPath 文件夹路径
 * @param regex 正则表达式
 * @param recursive 是否递归搜索，默认为 true
 * @returns 返回匹配的文件路径数组
 */
export const findFilesByRegex = (
  folderPath: string,
  regex: RegExp,
  recursive: boolean = true
): string[] => {
  const matchedFiles: string[] = [];

  try {
    // 检查文件夹是否存在
    if (!fs.existsSync(folderPath)) {
      logChannel.error(`文件夹不存在: ${folderPath}`);
      return matchedFiles;
    }

    // 检查是否为文件夹
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      logChannel.error(`路径不是文件夹: ${folderPath}`);
      return matchedFiles;
    }

    // 递归搜索文件
    const searchDirectory = (dirPath: string) => {
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const itemStat = fs.statSync(itemPath);

          if (itemStat.isDirectory()) {
            if (recursive) {
              searchDirectory(itemPath);
            }
          } else if (itemStat.isFile()) {
            logChannel.info(`搜索目录 regex: ${regex}`, item);
            if (regex.test(item)) {
              matchedFiles.push(itemPath);
              logChannel.info(`找到匹配文件: ${itemPath}`);
            }
          }
        }
      } catch (error) {
        logChannel.error(`搜索目录时发生错误: ${dirPath}`, error);
      }
    };

    searchDirectory(folderPath);

    logChannel.info(`搜索完成，共找到 ${matchedFiles.length} 个匹配的文件`);
    return matchedFiles;
  } catch (error) {
    logChannel.error(`查找文件时发生错误: ${folderPath}`, error);
    return matchedFiles;
  }
};

/**
 * 检测项目类型
 * @param projectPath 项目路径
 * @returns 返回项目类型：'java' | 'js' | 'unknown'
 */
export const detectProjectType = async (
  projectPath: string
): Promise<"java" | "js" | "unknown"> => {
  try {
    // 检查 pom.xml 文件（Maven 项目）
    const pomXmlPath = path.join(projectPath, "pom.xml");
    if (fs.existsSync(pomXmlPath)) {
      logChannel.info("检测到 Maven 项目 (pom.xml)");
      return "java";
    }

    // 检查 package.json 文件（Node.js/JavaScript 项目）
    const packageJsonPath = path.join(projectPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      logChannel.info("检测到 JavaScript/Node.js 项目 (package.json)");
      return "js";
    }

    logChannel.info("未检测到已知的项目类型");
    return "unknown";
  } catch (error) {
    logChannel.error("检测项目类型时发生错误:", error);
    return "unknown";
  }
};

/**
 * 重新加载 Cursor 窗口
 * @param showNotification 是否显示通知，默认为 true
 * @returns 返回操作结果
 */
export const reloadCursor = async (
  showNotification: boolean = true
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    if (showNotification) {
      vscode.window
        .showInformationMessage("正在重新加载 Cursor 窗口...", "取消")
        .then(selection => {
          if (selection === "取消") {
            return;
          }
          // 执行重新加载命令
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        });
    } else {
      // 直接执行重新加载命令
      await vscode.commands.executeCommand("workbench.action.reloadWindow");
    }

    logChannel.info("Cursor 窗口重新加载命令已执行");
    return {
      success: true,
      message: "Cursor 窗口重新加载命令已执行",
    };
  } catch (error) {
    logChannel.error("重新加载 Cursor 窗口失败:", error);
    return {
      success: false,
      message: `重新加载 Cursor 窗口失败: ${error}`,
    };
  }
};

/**
 * 重启 Cursor 应用程序
 * @param showNotification 是否显示通知，默认为 true
 * @returns 返回操作结果
 */
export const restartCursor = async (
  showNotification: boolean = true
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    if (showNotification) {
      const selection = await vscode.window.showInformationMessage(
        "重启 Cursor 将关闭所有窗口，是否继续？",
        "立即重启",
        "取消"
      );

      if (selection !== "立即重启") {
        return {
          success: false,
          message: "用户取消了重启操作",
        };
      }
    }

    logChannel.info("正在重启 Cursor 应用程序...");

    // 执行重启命令
    await vscode.commands.executeCommand(
      "workbench.action.restartExtensionHost"
    );

    // 等待一下再执行完全重启
    setTimeout(() => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    }, 1000);

    logChannel.info("Cursor 应用程序重启命令已执行");
    return {
      success: true,
      message: "Cursor 应用程序重启命令已执行",
    };
  } catch (error) {
    logChannel.error("重启 Cursor 应用程序失败:", error);
    return {
      success: false,
      message: `重启 Cursor 应用程序失败: ${error}`,
    };
  }
};

/**
 * 比较版本号
 * @param version1 版本1
 * @param version2 版本2
 * @returns 1: version1 > version2, -1: version1 < version2, 0: 相等
 */
export const compareVersions = (version1: string, version2: string): number => {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) {
      return 1;
    }
    if (v1Part < v2Part) {
      return -1;
    }
  }

  return 0;
};

/**
 * 弹出“插件已更新到版本”的提示，原理是保存PLUGIN_VERSION到存储，插件启动时比较PLUGIN_VERSION和存着的PLUGIN_VERSION
 */
export const checkPluginVersionUpdate = async (
  context: vscode.ExtensionContext
) => {
  const VERSION_KEY = "hello-copilot.lastVersion";
  const lastVersion = context.globalState.get<string>(VERSION_KEY, "0.0.0");

  const comparison = compareVersions(PLUGIN_VERSION, lastVersion);

  if (comparison > 0) {
    // 新版本
    logChannel.info(`插件版本更新: ${lastVersion} -> ${PLUGIN_VERSION}`);

    // 更新存储的版本号
    await context.globalState.update(VERSION_KEY, PLUGIN_VERSION);

    // 显示版本更新通知
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1003
    );
    statusBarItem.text = `$(sync) 插件已更新到版本 ${PLUGIN_VERSION}`;
    statusBarItem.show();

    // 5秒后自动隐藏
    setTimeout(() => {
      statusBarItem.dispose();
    }, 5000);

    // 可选：显示更详细的通知
    // vscode.window.showInformationMessage(
    //   `Hello Copilot 插件已更新到版本 ${PLUGIN_VERSION}`,
    //   "查看更新日志"
    // ).then((selection) => {
    //   if (selection === "查看更新日志") {
    //     // 可以打开更新日志或相关文档
    //     logChannel.show();
    //   }
    // });
  } else if (comparison === 0) {
    // 相同版本
    logChannel.info(`插件版本: ${PLUGIN_VERSION} (无更新)`);
  } else {
    // 降级（通常不会发生）
    logChannel.warn(`插件版本降级: ${lastVersion} -> ${PLUGIN_VERSION}`);
  }
};

/**
 * 检查远程插件更新
 * @param context 扩展上下文
 */
export const checkRemotePluginUpdate = async (
  context: vscode.ExtensionContext
) => {
  try {
    // 获取远程配置
    const remoteConfig = await getConfig();
    logChannel.info("远程配置:", remoteConfig);

    if (!remoteConfig || !remoteConfig.pluginVersion) {
      logChannel.warn("远程配置中未找到 pluginVersion 字段");
      return;
    }

    const remoteVersion = remoteConfig.pluginVersion;
    const comparison = compareVersions(remoteVersion, PLUGIN_VERSION);

    if (comparison > 0) {
      // 发现新版本
      logChannel.info(`发现新版本: ${PLUGIN_VERSION} -> ${remoteVersion}`);

      // 显示更新提示
      const selection = await vscode.window.showInformationMessage(
        `发现新版本 ${remoteVersion}，是否立即更新？`,
        "立即更新",
        "稍后提醒",
        "跳过此版本"
      );

      if (selection === "立即更新") {
        await downloadAndInstallUpdate(remoteConfig.downloadUrl, context);
      } else if (selection === "跳过此版本") {
        // 记录跳过的版本
        await context.globalState.update(
          "hello-copilot.skippedVersion",
          remoteVersion
        );
      }
    } else {
      logChannel.info(`当前版本 ${PLUGIN_VERSION} 已是最新版本`);
    }
  } catch (error) {
    logChannel.error("检查远程插件更新失败:", error);
  }
};

/**
 * 下载并安装插件更新
 * @param downloadUrl 下载链接
 * @param context 扩展上下文
 */
export const downloadAndInstallUpdate = async (
  downloadUrl: string,
  context: vscode.ExtensionContext
) => {
  try {
    if (!downloadUrl) {
      vscode.window.showErrorMessage("下载链接无效");
      return;
    }

    // 显示进度通知
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "正在下载插件更新",
        cancellable: false,
      },
      async progress => {
        try {
          progress.report({ message: "正在下载更新包..." });

          // 下载文件
          const response = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
            timeout: 60000, // 60秒超时
          });

          progress.report({ message: "下载完成，正在安装..." });

          const tempDir = os.tmpdir();
          const fileName = `hello-copilot-update-${Date.now()}.vsix`;
          const filePath = path.join(tempDir, fileName);

          fs.writeFileSync(filePath, response.data);

          progress.report({ message: "正在安装新版本..." });

          // 安装新版本
          await vscode.commands.executeCommand(
            "workbench.extensions.installExtension",
            vscode.Uri.file(filePath)
          );

          // 清理临时文件
          try {
            fs.unlinkSync(filePath);
          } catch (cleanupError) {
            logChannel.warn("清理临时文件失败:", cleanupError);
          }

          // 显示成功消息
          vscode.window
            .showInformationMessage(
              "插件更新完成，需要重新加载窗口以应用更改",
              "立即重新加载"
            )
            .then(selection => {
              if (selection === "立即重新加载") {
                reloadCursor(false);
              }
            });

          logChannel.info("插件更新安装完成");
        } catch (error: any) {
          logChannel.error("下载或安装更新失败:", error);
          vscode.window.showErrorMessage(`更新失败: ${error.message}`);
        }
      }
    );
  } catch (error: any) {
    logChannel.error("下载并安装插件更新失败:", error);
    vscode.window.showErrorMessage(`更新失败: ${error.message}`);
  }
};

/**
 * 检测指定插件是否已安装
 * @param extensionId 插件ID，例如 "ms-python.python"
 * @returns 返回插件信息，如果未安装则返回 null
 */
export const checkExtensionInstalled = (
  extensionId: string
): vscode.Extension<any> | null => {
  try {
    const extension = vscode.extensions.getExtension(extensionId);

    if (extension) {
      logChannel.info(
        `插件已安装: ${extensionId} (${
          extension.packageJSON.displayName || extension.id
        })`
      );
      return extension;
    } else {
      logChannel.info(`插件未安装: ${extensionId}`);
      return null;
    }
  } catch (error) {
    logChannel.error(`检测插件安装状态失败: ${extensionId}`, error);
    return null;
  }
};

/**
 * 检测指定插件是否已安装，如果没有则提示安装
 * @param extensionId 插件ID，例如 "ms-python.python"
 * @param extensionName 插件显示名称，用于提示用户
 * @param showInstallPrompt 是否显示安装提示，默认为 true
 * @returns 返回插件是否已安装
 */
export const checkAndPromptInstallExtension = async (
  extensionId: string,
  extensionName?: string,
  showInstallPrompt: boolean = true
): Promise<boolean> => {
  try {
    const extension = checkExtensionInstalled(extensionId);

    if (extension) {
      return true;
    }

    if (showInstallPrompt) {
      const displayName = extensionName || extensionId;
      const selection = await vscode.window.showWarningMessage(
        `检测到未安装插件 "${displayName}"，是否立即安装？`,
        "立即安装",
        "稍后提醒",
        "不再提醒"
      );

      if (selection === "立即安装") {
        await installExtension(extensionId);
        return false; // 安装后需要重新加载，所以返回 false
      } else if (selection === "不再提醒") {
        // 记录用户选择不再提醒此插件
        const context = vscode.extensions.getExtension(PLUGIN_ID)?.exports;
        if (context) {
          await context.globalState?.update(
            `hello-copilot.ignoreExtension.${extensionId}`,
            true
          );
        }
        logChannel.info(`用户选择不再提醒插件: ${extensionId}`);
      }
    }

    return false;
  } catch (error) {
    logChannel.error(`检测并提示安装插件失败: ${extensionId}`, error);
    return false;
  }
};

/**
 * 安装指定插件
 * @param extensionId 插件ID
 * @returns 返回安装结果
 */
export const installExtension = async (
  extensionId: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    logChannel.info(`开始安装插件: ${extensionId}`);

    // 显示进度通知
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在安装插件: ${extensionId}`,
        cancellable: false,
      },
      async progress => {
        progress.report({ message: "正在安装插件..." });

        // 执行安装命令
        await vscode.commands.executeCommand(
          "workbench.extensions.installExtension",
          extensionId
        );

        progress.report({ message: "插件安装完成" });
      }
    );

    // 验证安装结果
    const installedExtension = checkExtensionInstalled(extensionId);
    if (installedExtension) {
      const message = `插件 "${extensionId}" 安装成功！需要重新加载窗口以激活插件。`;
      logChannel.info(message);

      // 提示用户重新加载
      const reloadSelection = await vscode.window.showInformationMessage(
        message,
        "立即重新加载",
        "稍后重新加载"
      );

      if (reloadSelection === "立即重新加载") {
        await reloadCursor(false);
      }

      return {
        success: true,
        message: message,
      };
    } else {
      const message = `插件 "${extensionId}" 安装失败，请检查插件ID是否正确。`;
      logChannel.error(message);
      vscode.window.showErrorMessage(message);

      return {
        success: false,
        message: message,
      };
    }
  } catch (error: any) {
    const message = `安装插件 "${extensionId}" 时发生错误: ${error.message}`;
    logChannel.error(message, error);
    vscode.window.showErrorMessage(message);

    return {
      success: false,
      message: message,
    };
  }
};

/**
 * 批量检测多个插件是否已安装
 * @param extensionIds 插件ID数组
 * @param showInstallPrompt 是否显示安装提示，默认为 true
 * @returns 返回检测结果
 */
export const checkMultipleExtensions = async (
  extensionIds: string[],
  showInstallPrompt: boolean = true
): Promise<{
  installed: string[];
  notInstalled: string[];
  installResults: Array<{
    extensionId: string;
    success: boolean;
    message: string;
  }>;
}> => {
  const installed: string[] = [];
  const notInstalled: string[] = [];
  const installResults: Array<{
    extensionId: string;
    success: boolean;
    message: string;
  }> = [];

  try {
    for (const extensionId of extensionIds) {
      const isInstalled = checkExtensionInstalled(extensionId);

      if (isInstalled) {
        installed.push(extensionId);
      } else {
        notInstalled.push(extensionId);

        if (showInstallPrompt) {
          const result = await checkAndPromptInstallExtension(
            extensionId,
            undefined,
            true
          );
          if (result) {
            installed.push(extensionId);
            installResults.push({
              extensionId,
              success: true,
              message: "安装成功",
            });
          } else {
            installResults.push({
              extensionId,
              success: false,
              message: "用户取消安装或安装失败",
            });
          }
        }
      }
    }

    logChannel.info(
      `批量检测完成: 已安装 ${installed.length} 个，未安装 ${notInstalled.length} 个`
    );

    return {
      installed,
      notInstalled,
      installResults,
    };
  } catch (error) {
    logChannel.error("批量检测插件失败:", error);
    return {
      installed,
      notInstalled,
      installResults,
    };
  }
};

/**
 * 根据编辑器环境返回对应的数字标识
 * @returns 2: Cursor, 3: VSCode, 4: Kiro, 0: 未知编辑器
 */
export const getEditorTypeCode = (): number => {
  try {
    const appName = vscode.env.appName;

    if (!appName) {
      logChannel.warn("无法获取编辑器应用名称");
      return 0;
    }

    logChannel.info(`当前编辑器: ${appName}`);

    // 检查是否为 Cursor
    if (appName === "Cursor") {
      return 2;
    }

    // 检查是否为 VSCode
    if (appName === "Visual Studio Code") {
      return 3;
    }

    // 检查是否为 Kiro
    if (appName === "Kiro") {
      return 4;
    }

    // 其他未知编辑器
    logChannel.warn(`未知编辑器类型: ${appName}`);
    return 0;
  } catch (error) {
    logChannel.error("获取编辑器类型失败:", error);
    return 0;
  }
};

export const checkLogIn = (context: vscode.ExtensionContext): string => {
  // 1 未登录 2 登录中-2分钟之后未登录状态改为1 3 登录成功
  return context.globalState.get(HAS_LOGIN_KEY, "1");
};

export const popLogin = async (context: vscode.ExtensionContext) => {
  try {
    logChannel.info("显示 login 弹窗");

    // wait一会，确保弹窗能正确显示
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await vscode.window.showInformationMessage(
      `当前用户未登录, 请登录后使用`,
      { modal: false },
      "登录"
    );
    logChannel.info("弹窗结果:", result);

    if (result === "登录") {
      context.globalState.update(HAS_LOGIN_KEY, "2_" + Date.now());
      childProcess.exec(
        `open "https://login.dingtalk.com/oauth2/auth?redirect_uri=${encodeURIComponent(
          AEGIS_WEB_URL
        )}%2fauth%3fsource=${getEditorTypeCode()}&response_type=code&client_id=${DINGTALK_CLIENT_ID}&scope=openid+corpid&state=dddd&prompt=consent"`
      );
    }
  } catch (error) {
    console.error("执行登录时发生错误:", error);
    logChannel.error("执行登录时发生错误:", error);
  }
};

/**
 * 执行规则更新：接收后端推送的规则数据，写入到项目的.cursor/rules目录
 * 
 * 业务流程：
 * 1. 从WebSocket消息中接收规则数据（receivedData），包含规则列表、下发路径、扩展名等
 * 2. 弹出提示框询问用户是否更新
 * 3. 删除旧规则文件（对比上次下发的规则列表，找出已移除的规则）
 * 4. 写入新规则文件到指定目录（如.cursor/rules），文件名格式：规则名称+扩展名（如.mdc）
 * 5. 发送确认消息给后端，更新下发状态
 * 
 * @param receivedData 规则数据对象，包含：
 *   - key: 下发记录ID
 *   - groupName: 领域名称
 *   - detail: 规则详细内容列表（包含name和content）
 *   - directory: 下发路径（如".cursor/rules"）
 *   - extension: 文件扩展名（如".mdc"）
 *   - platform: 平台类型（"cursor"或"kiro"）
 *   - deletePromptList: 需要删除的旧规则名称列表
 *   - deletePromptExtension: 删除文件时使用的扩展名
 *   - deleteDirectory: 删除文件时使用的目录
 */
export const executeUpdate = async (
  receivedData: any,
  context: vscode.ExtensionContext,
  ws: any
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
    logChannel.info("显示 type 3 弹窗");
    logChannel.info("显示 type 3 弹窗 ReceivedUpdateData:", receivedData);
    let distributeKey = "distribute_" + receivedData.key;
    const pop = checkDistributePop(distributeKey, context);
    logChannel.info("显示 type 3 弹窗 pop:", pop);
    logChannel.info(
      "弹窗内容:",
      `${receivedData.groupName}: 有${receivedData.detail.length}条规则发布了新版本`
    );
    if (!pop) {
      return;
    }
    const workspacePath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const gitInfo = await getGitInfo(workspacePath);

    // 添加延迟确保弹窗能正确显示
    await new Promise(resolve => setTimeout(resolve, 100));

    // 弹出提示框，询问用户是否更新规则
    const result = await vscode.window.showInformationMessage(
      `${receivedData.groupName}: 有${receivedData.detail.length}条规则发布了新版本`,
      { modal: false },
      "更新"
    );
    // if (result === "取消") {
    //   ws.send(
    //     '{"key":"' +
    //       receivedData.key +
    //       '","email":"' +
    //       email +
    //       '","gitUrl":"' +
    //       gitInfo.remote +
    //       '","type":' +
    //       receivedData.type +
    //       ',"status":3,"source":' +
    //       getEditorTypeCode() +
    //       "}"
    //   );
    //   return;
    // }
    logChannel.info("弹窗结果:", result);

    if (result === "更新") {
      // 用户确认更新，开始处理规则文件
      context.globalState.update(distributeKey, "2_" + Date.now());
      // 确定文件扩展名：优先使用下发配置，否则根据平台自动判断（cursor=.mdc, kiro=.md）
      const ruleExtension = receivedData.extension
        ? receivedData.extension
        : receivedData.platform === "kiro"
        ? ".md"
        : receivedData.platform === "cursor"
        ? ".mdc"
        : getEditorTypeCode() === 2
        ? ".mdc"
        : ".md";

      // 确定删除文件时使用的扩展名（可能和当前扩展名不同，因为可能修改了扩展名配置）
      const deletePromptExtension = receivedData.deletePromptExtension
        ? receivedData.deletePromptExtension
        : receivedData.platform === "kiro"
        ? ".md"
        : receivedData.platform === "cursor"
        ? ".mdc"
        : getEditorTypeCode() === 2
        ? ".mdc"
        : ".md";

      // 确定删除文件时使用的目录（可能和当前目录不同）
      const deleteDirectory =
        getProjectPath() +
        "/" +
        (receivedData.deleteDirectory
          ? receivedData.deleteDirectory
          : receivedData.platform === "kiro"
          ? ".kiro"
          : receivedData.platform === "cursor"
          ? ".cursor"
          : "");

      logChannel.info(
        "ruleExtension:",
        ruleExtension,
        "deletePromptExtension:",
        deletePromptExtension
      );
      // 确定规则文件保存路径：优先使用下发配置的directory，否则使用默认路径
      const rulePathBase =
        getProjectPath() +
        "/" +
        (getEditorTypeCode() === 2 ? CURSOR_RULES_DIR : KIRO_RULES_DIR);
      await ensureDirectoryExists(rulePathBase);
      let rulePath = receivedData.directory
        ? receivedData.directory.endsWith("/")
          ? getProjectPath() + "/" + receivedData.directory
          : getProjectPath() + "/" + receivedData.directory + "/"
        : rulePathBase;
      // 删除已移除的旧规则文件（对比上次下发的规则列表）
      for (const item of receivedData.deletePromptList) {
        logChannel.info(
          "rulePathBase:",
          rulePathBase,
          "rulePath:",
          rulePath,
          "deletePromptList:",
          receivedData.deletePromptList,
          "deleteDirectory",
          receivedData.deleteDirectory
        );
        const tsFiles = await findFilesByRegex(
          rulePath,
          new RegExp(`${item}${deletePromptExtension}$`),
          true
        );
        logChannel.info("deletePromptList tsFiles:", tsFiles);

        // 删除匹配到的旧文件
        for (const filePath of tsFiles) {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
            logChannel.info(`已删除旧文件: ${filePath}`);
          } catch (error) {
            logChannel.error(`删除文件失败: ${filePath}`, error);
          }
        }
      }

      // 处理每个规则：删除旧文件，写入新文件
      for (const item of receivedData.detail) {
        logChannel.info(
          "rulePathBase:",
          rulePathBase,
          "rulePath:",
          rulePath,
          "item:",
          item
        );
        // 在删除目录中查找同名旧文件（可能扩展名不同）
        const tsFiles = await findFilesByRegex(
          deleteDirectory,
          new RegExp(`${item.name}${deletePromptExtension}$`),
          true
        );
        logChannel.info(item.name, "tsFiles:", tsFiles);

        // 删除匹配到的旧文件
        for (const filePath of tsFiles) {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
            logChannel.info(`已删除旧文件: ${filePath}`);
          } catch (error) {
            logChannel.error(`删除文件失败: ${filePath}`, error);
          }
        }

        // 在当前规则目录中查找同名文件（可能扩展名不同，需要删除后重新写入）
        const tsFilesNew = await findFilesByRegex(
          getProjectPath() +
            "/" +
            (getEditorTypeCode() === 2 ? ".cursor" : ".kiro"),
          new RegExp(`${item.name}.*\\${ruleExtension}$`),
          true
        );
        logChannel.info(item.name, "tsFilesNew:", tsFilesNew);

        for (const filePath of tsFilesNew) {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
            logChannel.info(`已删除旧文件: ${filePath}`);
          } catch (error) {
            logChannel.error(`删除文件失败: ${filePath}`, error);
          }
        }
        logChannel.info(
          `platform: ${receivedData.platform} cursor applyWay:`,
          item.applyWay
        );
        // 写入新规则文件：文件名=规则名称+扩展名，内容=规则内容
        if (receivedData.platform === "cursor") {
          // logChannel.info(`platform: cursor applyWay:`, item.applyWay);
          // if (item.applyWay) {
          //   await ensureFileExists(
          //     rulePath + item.name + ruleExtension,
          //     true,
          //     "---\n" + item.applyWay + "\n---\n",
          //     false
          //   );
          // }
          await ensureFileExists(
            rulePath + item.name + ruleExtension,
            true,
            item.content,
            false
          );
        } else {
          await ensureFileExists(
            rulePath + item.name + ruleExtension,
            true,
            item.content,
            false
          );
        }
      }
      reportActivity(15, receivedData);
      // 验证所有文件是否写入成功
      let isSuccess = true;
      for (const item of receivedData.detail) {
        const result = await ensureFileExists(
          rulePath + item.name + ruleExtension
        );
        isSuccess = isSuccess && result.success;
        logChannel.info(item.name, "isSuccess:", isSuccess);
      }
      if (isSuccess) {
        // 所有文件写入成功，发送确认消息给后端，更新下发状态为成功（status=1）
        deleteDistributeKey(distributeKey, context);
        ws.send(
          '{"key":"' +
            receivedData.key +
            '","email":"' +
            email +
            '","gitUrl":"' +
            gitInfo.remote +
            '","type":' +
            receivedData.type +
            ',"status":1,"source":' +
            getEditorTypeCode() +
            "}"
        );
      }
    }
  } catch (error) {
    console.error("执行更新时发生错误:", error);
    logChannel.error("执行更新时发生错误:", error);
  }
};

/**
 * 执行规则删除：接收后端推送的领域删除通知，删除本地规则文件
 * 
 * 业务流程：
 * 1. 从WebSocket消息中接收删除通知（receivedData），包含要删除的规则名称列表
 * 2. 弹出提示框询问用户是否删除本地文件
 * 3. 在指定目录中查找并删除匹配的规则文件
 * 4. 发送确认消息给后端，更新删除状态
 * 
 * @param receivedData 删除数据对象，包含：
 *   - key: 领域ID（groupId）
 *   - groupName: 领域名称
 *   - detail: 要删除的规则名称列表（JSON字符串）
 *   - directory: 规则文件所在目录
 *   - extension: 文件扩展名
 *   - platform: 平台类型
 */
export const executeDelete = async (
  receivedData: any,
  context: vscode.ExtensionContext,
  ws: any
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
    // 确定文件扩展名
    const ruleExtension = receivedData.extension
      ? receivedData.extension
      : receivedData.platform === "kiro"
      ? ".md"
      : receivedData.platform === "cursor"
      ? ".mdc"
      : getEditorTypeCode() === 2
      ? ".mdc"
      : ".md";
    const workspacePath =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const gitInfo = await getGitInfo(workspacePath);
    logChannel.info("Received data24 executeDelete 开始执行");
    logChannel.info(
      "Received data24 executeDelete receivedData:",
      JSON.stringify(receivedData)
    );

    let distributeKey = "distribute_" + receivedData.key;
    const pop = checkDistributePop(distributeKey, context);
    logChannel.info("Received data24 executeDelete pop:", pop);
    if (!pop) {
      return;
    }
    // 弹出提示框，询问用户是否删除本地规则文件
    const result = await vscode.window.showInformationMessage(
      `${receivedData.groupName}已删除, 是否删除本地文件?`,
      { modal: false },
      "是"
    );
    logChannel.info("Received data24 executeDelete result:", result);
    // if (result === "否") {
    //   ws.send(
    //     '{"key":"' +
    //       receivedData.key +
    //       '","email":"' +
    //       email +
    //       '","gitUrl":"' +
    //       gitInfo.remote +
    //       '","type":' +
    //       receivedData.type +
    //       ',"status":3,"source":' +
    //       getEditorTypeCode() +
    //       "}"
    //   );
    //   return;
    // }
    if (result === "是") {
      // 用户确认删除，开始删除本地规则文件
      context.globalState.update(distributeKey, "2_" + Date.now());
      // 遍历要删除的规则名称列表
      JSON.parse(receivedData.detail).forEach(async (item: any) => {
        // 在规则目录中查找匹配的规则文件（支持不同扩展名）
        const tsFilesDelete = await findFilesByRegex(
          getProjectPath() +
            "/" +
            (receivedData.directory
              ? receivedData.directory
              : getEditorTypeCode() === 2
              ? ".cursor"
              : ".kiro"),
          new RegExp(`${item}.*\\${ruleExtension}$`),
          true
        );
        logChannel.info(
          "Received data24 executeDelete tsFilesDelete:",
          tsFilesDelete
        );
        // 删除找到的文件
        for (const filePath of tsFilesDelete) {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
            logChannel.info(`已删除旧文件: ${filePath}`);
          } catch (error) {
            logChannel.error(`删除文件失败: ${filePath}`, error);
          }
        }
      });
      deleteDistributeKey(distributeKey, context);
      // 发送确认消息给后端，更新删除状态（status=2表示删除成功，action=17表示删除操作）
      ws.send(
        '{"key":"' +
          receivedData.key +
          '","email":"' +
          email +
          '","gitUrl":"' +
          gitInfo.remote +
          '","type":' +
          receivedData.type +
          ',"status":2,"action":17,"source":' +
          getEditorTypeCode() +
          "}"
      );
    }
    reportActivity(17, receivedData);
  } catch (error) {
    logChannel.error("executeDelete 执行时发生错误:", error);
    console.error("executeDelete 执行时发生错误:", error);
  }
};

export const checkDistributePop = (
  distributeKey: string,
  context: vscode.ExtensionContext
) => {
  let distributeStatus = context.globalState.get(distributeKey, "1");
  logChannel.info("distributeStatus:", distributeStatus);

  if (distributeStatus === "1") {
    return true;
  } else {
    if (distributeStatus.startsWith("2_")) {
      // 提取时间戳（"2_" 之后的字符串）
      const timestampStr = distributeStatus.substring(2);
      const timestamp = parseInt(timestampStr, 10);
      const currentTime = Date.now();
      const twoMinutes = 2 * 60 * 1000; // 2分钟的毫秒数
      logChannel.info(
        "distributeStatus currentTime:",
        currentTime,
        "timestamp",
        timestamp,
        currentTime - timestamp
      );
      // 如果超过2分钟，将状态改为1（未登录）
      if (currentTime - timestamp > twoMinutes) {
        deleteDistributeKey(distributeKey, context);
        return true;
      } else {
        // 未超过2分钟，直接返回
        return false;
      }
    }
  }
};

/**
 * 删除 globalState 中指定的 distributeKey
 * @param distributeId 分发ID
 * @param context 扩展上下文
 * @returns 返回删除结果
 */
export const deleteDistributeKey = async (
  distributeKey: string,
  context: vscode.ExtensionContext
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    await context.globalState.update(distributeKey, undefined);
    logChannel.info(`已删除 distributeKey: ${distributeKey}`);
    return {
      success: true,
      message: `已成功删除 distributeKey: ${distributeKey}`,
    };
  } catch (error) {
    logChannel.error(`删除 distributeKey 失败:`, error);
    return {
      success: false,
      message: `删除 distributeKey 失败: ${error}`,
    };
  }
};

/**
 * 删除 globalState 中所有以 "distribute_" 开头的键
 * @param context 扩展上下文
 * @returns 返回删除结果
 */
export const deleteAllDistributeKeys = async (
  context: vscode.ExtensionContext
): Promise<{
  success: boolean;
  message: string;
  deletedCount: number;
}> => {
  try {
    const keys = context.globalState.keys();
    const distributeKeys = keys.filter(key => key.startsWith("distribute_"));
    let deletedCount = 0;

    for (const key of distributeKeys) {
      await context.globalState.update(key, undefined);
      deletedCount++;
      logChannel.info(`已删除 distributeKey: ${key}`);
    }

    logChannel.info(`共删除 ${deletedCount} 个 distributeKey`);
    return {
      success: true,
      message: `已成功删除 ${deletedCount} 个 distributeKey`,
      deletedCount,
    };
  } catch (error) {
    logChannel.error(`删除所有 distributeKey 失败:`, error);
    return {
      success: false,
      message: `删除所有 distributeKey 失败: ${error}`,
      deletedCount: 0,
    };
  }
};
