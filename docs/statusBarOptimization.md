# 状态栏优化说明

## 问题描述

原来的 `vscode.window.showInformationMessage` 提示框宽度会超过侧边栏的宽度，影响用户体验。

## 解决方案

使用 VS Code 状态栏来显示消息，确保宽度与侧边栏保持一致。

## 技术实现

### 修改前
```typescript
// 使用信息提示框
vscode.window.showInformationMessage(`成功加载 ${nodes.length} 个 Prompt Groups`);
vscode.window.showWarningMessage("未获取到 Prompt Groups 数据");
vscode.window.showErrorMessage(`获取 Prompt Groups 失败: ${error.message}`);
```

### 修改后
```typescript
// 使用状态栏显示消息
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
statusBarItem.text = `$(check) 已加载 ${nodes.length} 个 Prompt Groups`;
statusBarItem.show();

// 自动隐藏
setTimeout(() => {
  statusBarItem.dispose();
}, 2000);
```

## 功能特性

### 1. 宽度适配
- 状态栏消息会自动适应侧边栏宽度
- 不会出现宽度超出的问题

### 2. 图标支持
- 成功消息：`$(check)` 图标
- 警告消息：`$(warning)` 图标  
- 错误消息：`$(error)` 图标

### 3. 自动隐藏
- 成功消息：2秒后自动隐藏
- 警告/错误消息：3秒后自动隐藏
- 避免状态栏堆积过多信息

### 4. 优先级控制
- 使用优先级 1000 确保消息显示在合适位置
- 左对齐显示，符合用户习惯

## 消息类型

| 消息类型 | 图标 | 显示时间 | 场景 |
|---------|------|---------|------|
| 成功 | $(check) | 2秒 | 数据加载成功 |
| 警告 | $(warning) | 3秒 | 未获取到数据 |
| 错误 | $(error) | 3秒 | 加载失败 |

## 用户体验改进

1. **视觉一致性**: 消息宽度与侧边栏保持一致
2. **信息清晰**: 使用图标快速识别消息类型
3. **自动清理**: 消息自动隐藏，不干扰用户操作
4. **位置合理**: 在状态栏显示，不遮挡主要内容

## 注意事项

- 状态栏消息需要手动管理生命周期
- 使用 `setTimeout` 和 `dispose()` 确保资源释放
- 避免同时显示多个状态栏消息造成冲突
