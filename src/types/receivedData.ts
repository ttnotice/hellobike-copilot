/**
 * 规则版本信息
 */
export interface RuleVersion {
  /** 版本号 */
  version: number;
  /** 版本内容 */
  content: string;
  /** 版本描述 */
  desc: string;
}

/**
 * 规则详情项
 */
export interface RuleDetail {
  /** 创建者 */
  creator: string;
  /** 业务类型 */
  business: string;
  /** 是否删除 */
  isDelete: boolean;
  /** 创建者邮箱 */
  creatorEmail: string;
  /** 描述 */
  description: string;
  /** 更新时间 */
  updateTime: string;
  /** 授权用户列表 */
  authorizedUsers: string[];
  /** 类型 */
  type: string;
  /** 版本号 */
  version: number;
  /** 内容 */
  content: string;
  /** 更新者 */
  updater: string;
  /** 更新者邮箱 */
  updaterEmail: string;
  /** 应用的文件匹配模式 */
  applyGlobs: string[];
  /** 应用方式 */
  applyWay: string;
  /** 创建时间 */
  createTime: string;
  /** MongoDB 版本字段 */
  __v: number;
  /** 规则名称 */
  name: string;
  /** 是否公开 */
  isPublic: boolean;
  /** 版本列表 */
  versionList: RuleVersion[];
  /** MongoDB ID */
  _id: string;
  /** 业务ID */
  id: string;
}

/**
 * 接收到的数据（更新场景）
 */
export interface ReceivedUpdateData {
  /** 分组名称 */
  groupName: string;
  /** 退出提示列表 */
  exitPromptList?: string[];
  /** 规则详情列表 */
  detail: RuleDetail[];
  /** 消息类型：3 表示更新 */
  type: 3;
  /** 目录路径 */
  directory?: string;
  /** 消息键 */
  key: string;
  /** 删除提示列表 */
  deletePromptList: string[];
  /** 操作类型（可选） */
  action?: number;
  /** GitLab 组名限制（可选） */
  gitlabGroup?: string[];
  /** GitLab 项目列表（可选） */
  gitlabProjects?: Array<{ name: string }>;
}

/**
 * 接收到的数据（删除场景）
 */
export interface ReceivedDeleteData {
  /** 分组名称 */
  groupName: string;
  /** 退出提示列表 */
  exitPromptList?: string[];
  /** 规则详情（删除场景中可能是字符串） */
  detail: string | RuleDetail[];
  /** 消息类型：可能是其他数字 */
  type: number;
  /** 目录路径 */
  directory?: string;
  /** 消息键 */
  key: string;
  /** 删除提示列表 */
  deletePromptList?: string[];
  /** 操作类型（可选，17 表示删除） */
  action?: number;
  /** GitLab 组名限制（可选） */
  gitlabGroup?: string[];
  /** GitLab 项目列表（可选） */
  gitlabProjects?: Array<{ name: string }>;
}

/**
 * 接收到的数据（通用类型）
 */
export type ReceivedData = ReceivedUpdateData | ReceivedDeleteData;
