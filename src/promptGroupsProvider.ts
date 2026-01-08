// src/promptGroupsProvider.ts
import * as vscode from "vscode";
import { getUserPromptGroups } from "./utils/aiPlatform";
import { checkLogIn } from "./utils/common";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

// 定义 Prompt Group 的数据结构
interface PromptGroup {
  id: string;
  name: string;
  description?: string;
  prompts?: Prompt[];
  children?: PromptGroup[];
}

interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  version?: string;
}

// 树节点的联合类型
type TreeNode = PromptGroupNode | PromptNode;

// Prompt Group 节点
class PromptGroupNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly promptGroup: PromptGroup,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Collapsed
  ) {
    super(label, collapsibleState);
    this.iconPath = new vscode.ThemeIcon("folder");
    this.tooltip = promptGroup.description || `Prompt Group: ${label}`;
    this.contextValue = "promptGroup";
  }
}

// Prompt 节点
class PromptNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly prompt: Prompt,
    public readonly parentGroup: PromptGroup
  ) {
    // 构建显示标签，包含版本信息
    const displayLabel = prompt.version
      ? `${label} (v${prompt.version})`
      : label;

    super(displayLabel, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("symbol-text");

    // 构建工具提示，包含版本信息
    const tooltipParts = [];
    if (prompt.description) {
      tooltipParts.push(prompt.description);
    }
    if (prompt.version) {
      tooltipParts.push(`版本: v${prompt.version}`);
    }
    this.tooltip =
      tooltipParts.length > 0 ? tooltipParts.join("\n") : `Prompt: ${label}`;
    this.contextValue = "promptWithUpdate";

    // 点击时显示 prompt 内容
    this.command = {
      command: "promptGroups.showPrompt",
      title: "显示 Prompt 内容",
      arguments: [this.prompt],
    };

    // 为右键菜单添加 prompt 数据
    this.resourceUri = vscode.Uri.parse(`prompt://${this.prompt.id}`);
  }
}

// TreeDataProvider 实现
export class PromptGroupsProvider implements vscode.TreeDataProvider<TreeNode> {
  // 事件发射器
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeNode | undefined | null | void
  > = new vscode.EventEmitter<TreeNode | undefined | null | void>();

  // 暴露给 VS Code 的事件
  readonly onDidChangeTreeData: vscode.Event<
    TreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  // 存储树形数据
  private treeData: PromptGroup[] = [];

  // 存储 prompt 数据映射，用于通过 ID 查找
  private promptMap: Map<string, Prompt> = new Map();

  // 存储 ExtensionContext
  private context: vscode.ExtensionContext;

  // 构造函数
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // 刷新数据
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // 根据 ID 获取 prompt 数据
  getPromptById(id: string): Prompt | undefined {
    return this.promptMap.get(id);
  }

  // 获取树项
  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  // 获取子节点
  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (element) {
      // 如果是 PromptGroup 节点，返回其下的 prompts
      if (element instanceof PromptGroupNode) {
        const prompts = element.promptGroup.prompts || [];
        return Promise.resolve(
          prompts.map(
            prompt => new PromptNode(prompt.name, prompt, element.promptGroup)
          )
        );
      }
      return Promise.resolve([]);
    } else {
      // 根节点，返回所有 prompt groups
      return this.fetchPromptGroups();
    }
  }

  // 获取 Prompt Groups 数据
  private async fetchPromptGroups(): Promise<PromptGroupNode[]> {
    return new Promise(resolve => {
      if (checkLogIn(this.context) !== "3") {
        logChannel.info("未登录, 无法获取 Prompt Groups 数据");
        return resolve([]);
      }
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "正在加载 Prompt Groups...",
          cancellable: false,
        },
        async progress => {
          try {
            logChannel.info("开始获取 Prompt Groups 数据...");

            // 调用 API 获取数据，筛选 type="normal" 的数据
            // const response = await getUserPromptGroups("normal");
            const response = await getUserPromptGroups();

            if (!response) {
              // 使用状态栏显示警告消息
              const statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Left,
                1000
              );
              statusBarItem.text = `$(warning) 未获取到 Prompt Groups 数据`;
              statusBarItem.show();

              // 3秒后自动隐藏状态栏消息
              setTimeout(() => {
                statusBarItem.dispose();
              }, 3000);

              resolve([]);
              return;
            }

            logChannel.info("获取到的 Prompt Groups 数据:", response);

            // 处理响应数据，转换为树形结构
            this.treeData = this.processResponseData(response);

            // 转换为树节点
            const nodes = this.treeData.map(
              group => new PromptGroupNode(group.name, group)
            );

            // 使用状态栏显示成功消息，避免宽度问题
            const statusBarItem = vscode.window.createStatusBarItem(
              vscode.StatusBarAlignment.Left,
              1000
            );
            const totalPrompts = this.treeData.reduce(
              (sum, group) => sum + (group.prompts ? group.prompts.length : 0),
              0
            );
            statusBarItem.text = `$(check) 已加载 ${nodes.length} 个组，${totalPrompts} 个 normal 类型 prompts`;
            statusBarItem.show();

            // 2秒后自动隐藏状态栏消息
            setTimeout(() => {
              statusBarItem.dispose();
            }, 2000);

            resolve(nodes);
          } catch (error: any) {
            logChannel.error("获取 Prompt Groups 失败:", error);

            // 使用状态栏显示错误消息
            const statusBarItem = vscode.window.createStatusBarItem(
              vscode.StatusBarAlignment.Left,
              1000
            );
            statusBarItem.text = `$(error) 加载 Prompt Groups 失败`;
            statusBarItem.show();

            // 3秒后自动隐藏状态栏消息
            setTimeout(() => {
              statusBarItem.dispose();
            }, 3000);

            resolve([]);
          }
        }
      );
    });
  }

  // 处理 API 响应数据，转换为树形结构
  private processResponseData(response: any): PromptGroup[] {
    // 处理 prompts 数据，确保包含 version 字段
    const processPrompts = (prompts: any[]): Prompt[] => {
      if (!Array.isArray(prompts)) {
        return [];
      }
      return prompts.map((prompt: any) => {
        const processedPrompt = {
          id: prompt.id || Math.random().toString(),
          name: prompt.name || prompt.title || "未命名 Prompt",
          content: prompt.content || prompt.text || "",
          description: prompt.description || prompt.desc,
          version: prompt.versionNo || prompt.version || prompt.ver || "1.0", // 优先使用 versionNo 字段
        };

        // 将 prompt 数据存储到映射中
        this.promptMap.set(processedPrompt.id, processedPrompt);

        return processedPrompt;
      });
    };

    // 根据实际的 API 响应结构来处理数据
    // 这里假设响应是一个包含 groups 的数组，每个 group 包含 promptList
    if (Array.isArray(response)) {
      return response.map((item: any) => ({
        id: item.id || item.groupId || Math.random().toString(),
        name: item.name || item.groupName || "未命名组",
        description: item.description || item.desc,
        prompts: processPrompts(item.prompts || item.promptList || []),
        children: item.children || [],
      }));
    } else if (response.groups && Array.isArray(response.groups)) {
      return response.groups.map((item: any) => ({
        id: item.id || item.groupId || Math.random().toString(),
        name: item.name || item.groupName || "未命名组",
        description: item.description || item.desc,
        prompts: processPrompts(item.prompts || item.promptList || []),
        children: item.children || [],
      }));
    } else {
      // 如果数据结构不符合预期，创建一个默认的组
      return [
        {
          id: "default",
          name: "默认组",
          description: "从 API 获取的数据",
          prompts: [],
          children: [],
        },
      ];
    }
  }
}
