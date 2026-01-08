# VS Code 插件卸载处理方式

## 方式 1: 使用 `vscode:uninstall` 脚本钩子（推荐）

### 适用场景
- 监听**自己插件**的卸载
- 需要在卸载时执行清理操作（如调用 logOut）

### 使用方法

1. **在 `package.json` 中添加脚本：**
```json
{
  "scripts": {
    "vscode:uninstall": "node uninstall.js"
  }
}
```

2. **创建 `uninstall.js` 脚本：**
   - 脚本会在插件卸载后、VS Code 重启时执行
   - 只能使用 Node.js（不能使用 TypeScript）
   - 可以执行 HTTP 请求、文件操作等清理工作

### 注意事项
- ⚠️ 脚本在插件**卸载后**执行，此时插件代码已不可用
- ⚠️ 脚本在 VS Code **重启后**执行，不是立即执行
- ✅ 适合执行服务器端的清理操作（如调用 API 登出）

---

## 方式 2: 使用 `onWillUninstallExtension` 激活事件

### 适用场景
- 监听**其他插件**的卸载
- 当指定插件即将被卸载时，激活当前插件

### 使用方法

1. **在 `package.json` 的 `activationEvents` 中添加：**
```json
{
  "activationEvents": [
    "onWillUninstallExtension:some-other-extension-id"
  ]
}
```

2. **在 `activate` 函数中处理：**
```typescript
export function activate(context: vscode.ExtensionContext) {
  // 当指定的其他插件即将被卸载时，会激活当前插件
  // 可以在这里执行清理操作
  logChannel.info("检测到其他插件即将被卸载");
}
```

### 注意事项
- ⚠️ 只能监听**其他插件**的卸载，不能监听自己的卸载
- ⚠️ 需要知道目标插件的完整 ID（格式：`publisher.extension-name`）
- ✅ 适合在依赖的插件卸载时执行清理操作

---

## 当前实现

本项目使用**方式 1**（`vscode:uninstall`）来处理插件卸载：

- ✅ `package.json` 中已配置 `vscode:uninstall` 脚本
- ✅ `uninstall.js` 脚本会在卸载时调用 `logOut` API
- ✅ `deactivate` 函数作为备用方案（可能不会触发）

## 测试方法

1. 安装插件
2. 在扩展面板中卸载插件
3. 重启 VS Code
4. 查看控制台输出，确认 `uninstall.js` 是否执行

