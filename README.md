# Hello Copilot

一个功能丰富的 VS Code 扩展，提供代码质量分析、单元测试执行、Sonar 上报等功能。

## 功能特性

### 🔍 代码质量分析

- **Sonar 代码质量分析**: 自动执行 Sonar 扫描，生成代码质量报告
- **覆盖率分析**: 支持 JaCoCo 覆盖率报告生成
- **多环境支持**: 支持 FAT、UAT、PRE、PRO 等不同环境

### 🧪 单元测试

- **Maven 测试执行**: 自动执行 Maven 单元测试
- **覆盖率报告**: 生成详细的代码覆盖率报告
- **测试结果展示**: 直观的测试执行结果展示
  {
  "user.name": "your-username",
  "user.email": "your.email@example.com",
  "git.name": "your-username",
  "git.email": "your.email@example.com"
  }

### 📋 规则下发

- **Cursor/Kiro 规则下发**: 支持规则下发到指定目录
- **平台规则同步删除**: 海螺平台规则删除后，插件端自动同步删除
- **主动更新规则**: 插件端支持主动更新规则

## 故障排除

### 用户信息获取失败

1. 检查是否已登录 Cursor
2. 确认环境变量设置正确
3. 检查配置文件格式
4. 查看扩展输出日志

### Sonar 分析失败

1. 确认项目为 Maven 项目
2. 检查网络连接
3. 验证 Sonar 配置
4. 查看详细错误日志

### 单元测试失败

1. 确认 Maven 环境配置
2. 检查项目依赖
3. 验证测试代码
4. 查看测试输出

## 更新日志

### v0.0.1

- 初始版本发布
- 支持 Sonar 代码质量分析
- 支持单元测试执行
- 支持 Cursor 用户信息获取
- 支持项目文件管理

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 支持

如有问题，请通过以下方式联系：

- 提交 GitHub Issue
- 联系 ttnotice@hellobike.com
- 查看扩展输出日志
- 检查配置设置

## 打包

vsce pacakge
