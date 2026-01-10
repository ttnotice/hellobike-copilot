// src/promptGroupsProvider.ts
import * as vscode from "vscode";
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
