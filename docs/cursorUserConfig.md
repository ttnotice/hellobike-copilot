# Cursor 用户信息配置指南

本文档详细说明了如何在 Cursor 插件中配置和获取用户登录信息。

## 概述

Cursor 插件提供了多种方式来获取用户登录信息，包括账号、邮箱、显示名称等。插件会智能地从多个来源获取信息，确保在各种环境下都能正常工作。

## 配置方式

### 1. 环境变量配置

#### 基本环境变量
```bash
# 设置用户邮箱
export CURSOR_EMAIL="your.email@example.com"
export GITHUB_EMAIL="your.github@example.com"
export EMAIL="your.email@example.com"

# 设置用户账号
export CURSOR_USER="your-username"
export USER="your-username"
```

#### 在 shell 配置文件中设置
**bash (.bashrc, .bash_profile)**
```bash
# 添加到 ~/.bashrc 或 ~/.bash_profile
export CURSOR_EMAIL="your.email@example.com"
export CURSOR_USER="your-username"
```

**zsh (.zshrc)**
```bash
# 添加到 ~/.zshrc
export CURSOR_EMAIL="your.email@example.com"
export CURSOR_USER="your-username"
```

**Windows (环境变量)**
```cmd
# 在系统环境变量中设置
set CURSOR_EMAIL=your.email@example.com
set CURSOR_USER=your-username
```

### 2. VS Code 配置

#### 工作区配置 (推荐)
在项目根目录创建 `.vscode/settings.json`：
```json
{
  "cursor.account": "your-username",
  "cursor.email": "your.email@example.com",
  "cursor.displayName": "Your Display Name"
}
```

#### 全局配置
在 VS Code 的用户设置中添加：
```json
{
  "cursor.account": "your-username",
  "cursor.email": "your.email@example.com",
  "cursor.displayName": "Your Display Name"
}
```

### 3. Cursor 配置文件

#### macOS
```json
// ~/Library/Application Support/Cursor/User/settings.json
{
  "user.name": "your-username",
  "user.email": "your.email@example.com",
  "git.name": "your-username",
  "git.email": "your.email@example.com",
  "cursor.user.name": "your-username",
  "cursor.user.email": "your.email@example.com"
}
```

#### Windows
```json
// %APPDATA%\Cursor\User\settings.json
{
  "user.name": "your-username",
  "user.email": "your.email@example.com",
  "git.name": "your-username",
  "git.email": "your.email@example.com",
  "cursor.user.name": "your-username",
  "cursor.user.email": "your.email@example.com"
}
```

#### Linux
```json
// ~/.config/Cursor/User/settings.json
{
  "user.name": "your-username",
  "user.email": "your.email@example.com",
  "git.name": "your-username",
  "git.email": "your.email@example.com",
  "cursor.user.name": "your-username",
  "cursor.user.email": "your.email@example.com"
}
```

### 4. Git 配置

#### 全局 Git 配置
```bash
git config --global user.name "your-username"
git config --global user.email "your.email@example.com"
```

#### 项目级 Git 配置
```bash
git config user.name "your-username"
git config user.email "your.email@example.com"
```

## 优先级顺序

插件会按以下优先级获取用户信息：

1. **VS Code 认证服务** - 最可靠，需要用户登录
2. **Cursor 配置文件** - 本地配置，优先级较高
3. **环境变量** - 系统级配置，适合自动化环境
4. **VS Code 配置** - 工作区或全局配置
5. **系统用户信息** - 作为最后的备选方案

## 使用示例

### 基本使用
```typescript
import { getCursorUserInfo } from './utils/cursorUser';

// 获取用户信息
const userInfo = await getCursorUserInfo();

if (userInfo.isLoggedIn) {
  console.log(`欢迎, ${userInfo.account}!`);
  console.log(`邮箱: ${userInfo.email}`);
  console.log(`信息来源: ${userInfo.source}`);
} else {
  console.log('用户未登录');
}
```

### 显示用户信息
```typescript
import { showCursorUserInfo } from './utils/cursorUser';

// 显示用户信息弹窗
await showCursorUserInfo();
```

### 日志记录
```typescript
import { getUserInfoForLog } from './utils/cursorUser';

// 获取日志格式的用户信息
const logInfo = getUserInfoForLog();
console.log(`[${new Date().toISOString()}] ${logInfo}`);
```

### 获取所有信息源
```typescript
import { getAllUserInfoSources } from './utils/cursorUser';

// 获取所有可用的信息源
const allSources = await getAllUserInfoSources();

for (const [sourceName, userInfo] of Object.entries(allSources)) {
  console.log(`${sourceName}: ${userInfo.isLoggedIn ? '已登录' : '未登录'}`);
}
```

## 故障排除

### 常见问题

#### 1. 用户信息获取失败
**症状**: 所有信息源都返回 "unknown"
**解决方案**:
- 检查环境变量是否正确设置
- 确认配置文件格式正确
- 重启 VS Code/Cursor
- 检查文件权限

#### 2. 配置文件无法读取
**症状**: 配置文件相关的信息源失败
**解决方案**:
- 检查文件路径是否正确
- 确认 JSON 格式正确
- 检查文件权限
- 验证文件编码（应为 UTF-8）

#### 3. 环境变量不生效
**症状**: 环境变量设置后仍无法获取
**解决方案**:
- 重启终端/命令提示符
- 重启 VS Code/Cursor
- 检查环境变量名称是否正确
- 确认环境变量已正确设置

#### 4. 认证服务失败
**症状**: VS Code 认证相关的信息源失败
**解决方案**:
- 检查网络连接
- 确认已登录 Cursor/GitHub
- 重新登录认证服务
- 检查认证令牌是否过期

### 调试方法

#### 1. 查看扩展输出
在 VS Code 中按 `Ctrl+Shift+P`，输入 "Developer: Show Output"，选择 "Hello Copilot" 查看详细日志。

#### 2. 启用调试模式
在 VS Code 设置中启用扩展的调试模式：
```json
{
  "hello-copilot.debug": true
}
```

#### 3. 检查配置状态
使用命令 "获取 Cursor 用户信息" 来测试配置是否正确。

## 最佳实践

### 1. 配置优先级
- 优先使用环境变量进行自动化配置
- 使用 VS Code 工作区配置进行项目级配置
- 使用 Cursor 配置文件进行个人配置

### 2. 安全性
- 不要在代码中硬编码用户信息
- 使用环境变量存储敏感信息
- 定期更新认证令牌

### 3. 兼容性
- 确保配置在所有目标环境中都可用
- 提供合理的默认值
- 处理配置缺失的情况

### 4. 性能
- 缓存用户信息，避免重复获取
- 异步获取信息，不阻塞主线程
- 提供降级方案

## 更新日志

### v0.0.1
- 初始版本发布
- 支持多种信息源
- 智能优先级选择
- 完整的错误处理
- 详细的日志记录

## 支持

如有问题或建议，请：
1. 查看本文档的故障排除部分
2. 检查扩展输出日志
3. 提交 GitHub Issue
4. 联系开发团队
