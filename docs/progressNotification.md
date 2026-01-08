# 进度提示功能说明

## 功能概述

修复了 Prompt Groups 数据加载时的进度提示问题，现在使用 `vscode.window.withProgress` 来显示进度信息，确保在操作完成后自动关闭提示。

## 修复内容

### 问题描述
- 原来使用 `vscode.window.showInformationMessage("正在加载 Prompt Groups...")` 显示加载提示
- 该提示不会自动关闭，会一直显示在通知栏中
- 用户体验不佳，无法知道加载是否完成

### 解决方案
- 使用 `vscode.window.withProgress` 替代简单的信息提示
- 进度提示会在操作完成后自动关闭
- 提供更好的用户体验和视觉反馈

## 技术实现

### 修改前
```typescript
// 显示加载信息
vscode.window.showInformationMessage("正在加载 Prompt Groups...");

// 调用 API 获取数据
const response = await getUserPromptGroups();

// ... 处理数据

// 显示成功消息
vscode.window.showInformationMessage(`成功加载 ${nodes.length} 个 Prompt Groups`);
```

### 修改后
```typescript
return new Promise((resolve) => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "正在加载 Prompt Groups...",
      cancellable: false
    },
    async (progress) => {
      try {
        // 调用 API 获取数据
        const response = await getUserPromptGroups();
        
        // ... 处理数据
        
        // 显示成功消息
        vscode.window.showInformationMessage(`成功加载 ${nodes.length} 个 Prompt Groups`);
        
        resolve(nodes);
      } catch (error: any) {
        // 错误处理
        resolve([]);
      }
    }
  );
});
```

## 功能特性

### 1. 自动关闭
- 进度提示会在操作完成后自动关闭
- 无论成功还是失败都会关闭提示

### 2. 视觉反馈
- 使用 VS Code 标准的进度通知样式
- 提供清晰的加载状态指示

### 3. 错误处理
- 包含完善的错误处理机制
- 确保在出错时也能正确关闭提示

### 4. 用户体验
- 避免通知栏堆积过多提示
- 提供清晰的操作状态反馈

## 使用场景

1. **数据加载**: 当用户首次打开侧边栏时
2. **刷新数据**: 当用户点击刷新按钮时
3. **API 调用**: 当调用 `getUserPromptGroups()` 时

## 注意事项

- 进度提示不可取消（`cancellable: false`）
- 使用 `vscode.ProgressLocation.Notification` 位置显示
- 确保在所有代码路径中都能正确关闭提示
