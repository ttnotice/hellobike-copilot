import axios, { AxiosInstance } from "axios";
import { AIPLATFROM_PROMPT_URL } from "./constants";
import {
  getGitUserConfigFromCommand,
  getPluginInfo,
  getGitInfo,
} from "./common";
import { getCursorUserInfo, showCursorUserInfo, getUserInfoForLog } from "./cursorUser";
import * as vscode from "vscode";

const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

const env = vscode.env;

const repoRegex =
  /^(ssh:\/\/git@gitlab\.hellobike\.cn:10022|https:\/\/gitlab\.hellobike\.cn).*/;
const userRegex = /@hellobike\.com$/;

const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

const logChannel = vscode.window.createOutputChannel("Hello Copilot", {
  log: true,
});

export const getUserPromptGroups = async (filterType?: string) => {
  let gitInfo = await getGitInfo(workspacePath);
  let gitUserInfo = await getGitUserConfigFromCommand();
  let pluginInfo = await getPluginInfo();
  logChannel.info("pluginInfo", pluginInfo);

  const userInfo = await getCursorUserInfo();
  logChannel.info("userInfo", userInfo);
  if (
    gitInfo.remote &&
    gitUserInfo.email &&
    repoRegex.test(gitInfo.remote) &&
    !userRegex.test(gitUserInfo.email)
  ) {
    vscode.window.showInformationMessage(
      `Git user: ${gitUserInfo.email}为非hello邮箱, 请检查后重新配置!`
    );
  }

  // 构建请求数据，使用用户的邮箱
  const payload =gitInfo.remote? {
    email: gitUserInfo.email || userInfo.email,
    git: [gitInfo.remote],
  }: {
    email: gitUserInfo.email || userInfo.email ,
  };
  
  logChannel.info("getUserPromptGroups payload", payload);
  
  try {
    const response = await axios.post(AIPLATFROM_PROMPT_URL, payload, config);
    if (response.status === 200) {
      logChannel.info("getUserPromptGroups responseData:", response.data);
      
      // 处理响应数据，确保返回正确的格式
      const responseData = response.data;
      
      // 如果响应有 data 字段，使用 data 字段
      let data = responseData && responseData.data ? responseData.data : responseData;
      
      // 如果指定了筛选类型，则筛选数据
      if (filterType && data) {
        data = filterPromptGroupsByType(data, filterType);
        logChannel.info(`筛选 type="${filterType}" 后的数据:`, data);
      }
      
      return data;
    } else {
      logChannel.error("getUserPromptGroups failed:", response.status, response.data);
      return null;
    }
  } catch (e: any) {
    logChannel.error("getUserPromptGroups failed:", e.message);
    
    // 如果是网络错误，返回模拟数据用于测试
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.response?.status >= 500) {
      logChannel.warn("网络连接失败，返回模拟数据用于测试");
      const mockData = getMockPromptGroupsData();
      // 如果指定了筛选类型，则筛选模拟数据
      if (filterType) {
        return filterPromptGroupsByType(mockData, filterType);
      }
      return mockData;
    }
    
    return null;
  }
};

// 筛选 Prompt Groups 数据根据 type 字段
function filterPromptGroupsByType(data: any, filterType: string): any {
  if (!data || !Array.isArray(data)) {
    return data;
  }

  return data.filter((group: any) => {
    // 根据组的 type 字段进行筛选
    return group.type === filterType;
  }).map((group: any) => {
    // 将 promptList 重命名为 prompts 以保持兼容性
    return {
      ...group,
      prompts: group.promptList || []
    };
  });
}

// 模拟数据，用于测试和演示
function getMockPromptGroupsData() {
  return [
    {
        "groupId": "zk0KLqQSACgbUY8g",
        "name": "大前端ai项目",
        "description": "大前端ai项目",
        "type": "normal",
        "creator": "梅瑞珂",
        "creatorEmail": "meiruike750@hellobike.com",
        "createTime": "2025-08-29T08:12:30.344Z",
        "updateTime": "2025-09-03T03:07:15.248Z",
        "promptList": [
            {
                "id": "uJSVUY2uoS0H3Qiq",
                "name": "视频创作提示词",
                "versionNo": 5,
                "content": "# 角色: 专业心理咨询师哈哈哈哈哈\n\n## 目标:\n为用户提供专业的心理咨询服务，帮助用户解决心理问题，提供情感支持和建议。\n\n## 技能:\n1. 具备专业的心理学知识和咨询技巧\n2. 能够建立良好的信任关系\n3. 善于倾听和共情\n4. 能够提供实用的建议和解决方案\n\n## 工作流:\n1. 倾听用户的问题和困扰\n2. 分析问题的根源和影响因素\n3. 提供专业的建议和解决方案\n4. 跟进用户的进展并提供持续支持\n# 角色: 专业心理咨询师哈哈哈哈哈\n\n## 目标:\n为用户提供专业的心理咨询服务，帮助用户解决心理问题，提供情感支持和建议。\n\n## 技能:\n1. 具备专业的心理学知识和咨询技巧\n2. 能够建立良好的信任关系\n3. 善于倾听和共情\n4. 能够提供实用的建议和解决方案\n\n## 工作流:\n1. 倾听用户的问题和困扰\n2. 分析问题的根源和影响因素\n3. 提供专业的建议和解决方案\n4. 跟进用户的进展并提供持续支持",
                "description": "视频创作提示词"
            },
            {
                "id": "MtpCB7Bvq6i1uysM",
                "name": "1111",
                "versionNo": 7,
                "content": "111111333344444313221322122",
                "description": "11112222"
            }
        ]
    }
  ];
}