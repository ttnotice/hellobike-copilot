# AI Prompt Groups 侧边栏功能

## 功能概述

AI Prompt Groups 侧边栏是一个新的 VS Code 扩展功能，允许用户查看和管理 AI 平台的 Prompt 组。该功能通过树形结构展示 Prompt Groups 和其中的 Prompt 内容。

## 功能特性

### 1. 侧边栏按钮
- 在 VS Code 左侧活动栏中新增了 "AI Prompt Groups" 按钮
- 图标使用 `$(symbol-text)` 表示文本相关功能
- 点击按钮可以打开/关闭侧边栏

### 2. 树形数据展示
- **Prompt Groups**: 显示为文件夹图标，可展开/折叠
- **Prompts**: 显示为文本图标，包含版本信息，点击可查看内容
- 支持多级嵌套结构
- **版本显示**: 每个 Prompt 节点显示版本号，格式为 "Prompt名称 (v版本号)"

### 3. 交互功能
- **刷新按钮**: 重新加载 Prompt Groups 数据
- **点击 Prompt**: 在新标签页中显示 Prompt 的详细内容
- **复制功能**: 在 Prompt 详情页面可以复制内容到剪贴板
- **右键更新**: 右键点击 Prompt 节点，选择"更新到 Rules 文件"将内容写入项目

## 使用方法

### 1. 打开侧边栏
1. 在 VS Code 左侧活动栏中找到 "AI Prompt Groups" 图标
2. 点击图标打开侧边栏

### 2. 查看 Prompt Groups
1. 侧边栏会自动加载用户的 Prompt Groups 数据
2. 展开 Prompt Group 可以看到其中的 Prompts
3. 点击刷新按钮可以重新加载数据

### 3. 查看 Prompt 内容
1. 点击任意 Prompt 项目
2. 系统会在新标签页中打开 Prompt 详情
3. 在详情页面可以查看完整的 Prompt 内容
4. 点击"复制内容"按钮可以将内容复制到剪贴板

### 4. 更新到 Rules 文件
1. 右键点击任意 Prompt 节点
2. 选择"更新到 Rules 文件"选项
3. 系统会自动创建 `.cursor/rules` 目录（如果不存在）
4. 将 Prompt 内容写入到 `name_version.mdc` 文件中
5. 显示成功消息，可选择直接打开生成的文件

## 数据来源

### API 调用
- 使用 `getUserPromptGroups()` 函数调用 AI Platform API
- API 地址: `https://metis2.hellobike.cn/api/v1/promptGroup/userGroups`
- 请求参数: `{ "email": "用户邮箱" }`

### API 数据结构
- **Prompt Groups**: 包含 `promptList` 数组
- **Prompt 元素**: 包含以下字段：
  - `name`: Prompt 名称
  - `versionNo`: 版本号
  - `content`: Prompt 内容
  - `description`: Prompt 描述
  - `id`: 唯一标识符

### 用户邮箱获取优先级
1. Git 配置的邮箱
2. Cursor 用户邮箱
3. 默认邮箱: `xulingjian866@hellobike.com`

### 模拟数据
- 当 API 调用失败时，系统会返回模拟数据用于测试
- 模拟数据包含三个示例组：代码审查组、文档生成组、测试用例组
- 每个 Prompt 都包含版本信息，用于演示版本显示功能

### 版本功能
- **版本显示**: 在树形结构中，每个 Prompt 节点都会显示版本号
- **版本格式**: 显示为 "Prompt名称 (v版本号)" 的格式
- **工具提示**: 鼠标悬停时显示版本信息
- **默认版本**: 如果 API 数据中没有版本信息，默认显示 "v1.0"
- **版本兼容**: 优先使用 `versionNo` 字段，兼容 `version`、`ver` 等字段名称

### Rules 文件功能
- **文件路径**: 自动创建 `.cursor/rules` 目录
- **文件命名**: 使用 `name_version.mdc` 格式命名文件
- **文件内容**: 包含 Prompt 的标题、描述和完整内容
- **自动创建**: 如果目录不存在，会自动创建
- **文件格式**: 使用 Markdown 格式，便于阅读和编辑
- **用户反馈**: 操作完成后显示成功消息，可选择打开文件

## 技术实现

### 文件结构
```
src/
├── promptGroupsProvider.ts    # TreeDataProvider 实现
├── extension.ts              # 扩展主文件，注册命令和提供者
└── utils/
    └── aiPlatform.ts         # API 调用函数
```

### 主要类
- `PromptGroupsProvider`: 实现 `vscode.TreeDataProvider` 接口，包含 prompt 数据映射
- `PromptGroupNode`: Prompt Group 树节点
- `PromptNode`: Prompt 树节点，支持版本信息显示和右键菜单

### 命令注册
- `promptGroups.refresh`: 刷新数据
- `promptGroups.showPrompt`: 显示 Prompt 内容
- `promptGroups.updateToRules`: 更新到 Rules 文件

### 数据传递机制
- **Prompt 数据映射**: 使用 `Map<string, Prompt>` 存储所有 prompt 数据
- **节点标识**: 每个 PromptNode 包含唯一的 `resourceUri` 标识
- **右键菜单**: 通过节点标识从映射中获取完整的 prompt 数据
- **错误处理**: 包含完善的错误处理和日志记录

## 配置说明

### package.json 配置
```json
{
  "viewsContainers": {
    "activitybar": [
      {
        "id": "prompt-groups-container",
        "title": "AI Prompt Groups",
        "icon": "$(symbol-text)"
      }
    ]
  },
  "views": {
    "prompt-groups-container": [
      {
        "id": "promptGroups",
        "name": "Prompt Groups",
        "type": "tree"
      }
    ]
  }
}
```

## 错误处理

### 网络错误
- 当 API 调用失败时，显示错误信息
- 自动返回模拟数据用于演示

### 数据格式错误
- 支持多种 API 响应格式
- 自动适配不同的数据结构

## 未来扩展

### 计划功能
1. **搜索功能**: 在 Prompt Groups 中搜索特定内容
2. **编辑功能**: 直接在侧边栏中编辑 Prompt
3. **收藏功能**: 标记常用的 Prompt
4. **分类管理**: 支持自定义分类和标签
5. **导入导出**: 支持 Prompt 的批量导入导出
6. **批量更新**: 支持批量更新多个 Prompt 到 Rules 文件
7. **文件管理**: 支持删除和重命名已生成的 Rules 文件

## 使用示例

### Rules 文件生成示例
当用户右键点击 "代码质量检查 (v1.2)" 并选择"更新到 Rules 文件"时，系统会：

1. 从 API 数据中获取：
   - `name`: "代码质量检查"
   - `versionNo`: "1.2"
   - `content`: Prompt 内容
   - `description`: "检查代码质量的通用 Prompt"

2. 创建文件路径: `项目根目录/.cursor/rules/代码质量检查_1.2.mdc`

3. 生成文件内容:
```markdown
# 代码质量检查

> 检查代码质量的通用 Prompt

请检查以下代码的质量问题，包括但不限于：
1. 代码规范
2. 性能问题
3. 安全问题
4. 可维护性

代码：
{code}
```

4. 显示成功消息并提供"打开文件"选项

### 性能优化
1. **缓存机制**: 缓存 API 响应数据
2. **懒加载**: 按需加载 Prompt 内容
3. **虚拟滚动**: 支持大量数据的流畅展示
