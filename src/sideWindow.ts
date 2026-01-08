// src/fileExplorer.ts
import * as vscode from "vscode";
import * as path from "path";
import { getUnCoveredInfo } from "./utils/aegis";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

// Define the structure of an item from the API's unCoveredMethodList
interface UncoveredMethodItem {
  package: string;
  class: string;
  className: string; // This is actually the method name
}

// A union type for any node in our tree
type TreeNode = PackageNode | ClassNode | MethodNode;

// --- TreeItem Implementations for each level ---

class PackageNode extends vscode.TreeItem {
  constructor(public readonly label: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("symbol-namespace");
  }
}

class ClassNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly packageName: string // Store parent package
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("symbol-class");
  }
}

class MethodNode extends vscode.TreeItem {
  constructor(
    public readonly label: string, // The method signature, e.g., "getCarGuideUrl()"
    public readonly className: string, // The class name, e.g., "PaxDetailConfigManager"
    public readonly packageName: string // The package name
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("symbol-method");
    // Define the command that runs when this item is clicked
    this.command = {
      command: "aegisUncovered.openFile",
      title: "Open Method Location",
      arguments: [this.packageName, this.className, this.label],
    };
  }
}

// --- The TreeDataProvider Implementation ---

export class UncoveredMethodsProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  // 1. 创建一个事件发射器
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeNode | undefined | null | void
  > = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  // 2. 将这个事件暴露给 VS Code
  readonly onDidChangeTreeData: vscode.Event<
    TreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private param: number = 2; // 默认参数

  setParam(param: number) {
    this.param = param;
    this.refresh();
  }

  // Store the hierarchical data
  private treeData: Map<string, Map<string, string[]>> = new Map();

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (element) {
      // Get children of a PackageNode (which are ClassNodes)
      if (element instanceof PackageNode) {
        const classes = this.treeData.get(element.label)?.keys();
        return Promise.resolve(
          Array.from(classes || []).map((c) => new ClassNode(c, element.label))
        );
      }
      // Get children of a ClassNode (which are MethodNodes)
      if (element instanceof ClassNode) {
        const methods = this.treeData
          .get(element.packageName)
          ?.get(element.label);
        return Promise.resolve(
          Array.from(methods || []).map(
            (m) => new MethodNode(m, element.label, element.packageName)
          )
        );
      }
      return Promise.resolve([]);
    } else {
      console.log("当前参数:", this.param);
      return this.fetchAndProcessData(this.param ? this.param : 2);
    }
  }

  private async fetchAndProcessData(
    gtUnCoveredTimes: number
  ): Promise<PackageNode[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showInformationMessage(
        "Please open a project folder first."
      );
      return [];
    }
    const serviceName = workspaceFolder.name;

    try {
      vscode.window.showInformationMessage(
        `Fetching uncovered methods for [${serviceName}]...`
      );
      const response = await getUnCoveredInfo(gtUnCoveredTimes);

      const uncoveredList = response?.unCoveredMethodList;
      if (!uncoveredList || uncoveredList.length === 0) {
        vscode.window.showInformationMessage("No uncovered methods found.");
        return [];
      }

      // Process the flat list into a hierarchical map
      this.treeData.clear();
      for (const item of uncoveredList) {
        const { package: pkg, class: cls, className: method } = item;
        if (!this.treeData.has(pkg)) {
          this.treeData.set(pkg, new Map<string, string[]>());
        }
        if (!this.treeData.get(pkg)!.has(cls)) {
          this.treeData.get(pkg)!.set(cls, []);
        }
        this.treeData.get(pkg)!.get(cls)!.push(method);
      }

      // Return the top-level nodes (packages)
      return Array.from(this.treeData.keys()).map(
        (pkgName) => new PackageNode(pkgName)
      );
    } catch (error) {
      console.error("Failed to fetch uncovered methods:", error);
      vscode.window.showErrorMessage(
        "Failed to call Aegis API. Check the logs for details."
      );
      return [];
    }
  }
}
