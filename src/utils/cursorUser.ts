import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 获取 Cursor 用户登录信息
 * 包括账号、邮箱等信息
 */
export interface CursorUserInfo {
  /** 用户账号 */
  account: string;
  /** 用户邮箱 */
  email: string;
  /** 用户显示名称 */
  displayName?: string;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 获取方式 */
  source: string;
}

/**
 * 获取 Cursor 用户信息
 * 通过多种方式尝试获取用户登录状态
 */
export async function getCursorUserInfo(): Promise<CursorUserInfo> {
  try {
    // 方法1: 尝试从 VS Code 的认证服务获取
    const authInfo = await getAuthInfo();
    if (authInfo.isLoggedIn) {
      return authInfo;
    }

    // 方法2: 尝试从 Cursor 配置文件获取
    const cursorConfigInfo = await getCursorConfigInfo();
    if (cursorConfigInfo.isLoggedIn) {
      return cursorConfigInfo;
    }

    // 方法3: 尝试从环境变量获取
    const envInfo = getEnvUserInfo();
    if (envInfo.isLoggedIn) {
      return envInfo;
    }

    // 方法4: 尝试从 VS Code 配置获取
    const configInfo = await getConfigUserInfo();
    if (configInfo.isLoggedIn) {
      return configInfo;
    }

    // 方法5: 尝试从系统用户信息获取
    const systemInfo = getSystemUserInfo();
    if (systemInfo.isLoggedIn) {
      return systemInfo;
    }

    // 如果都获取不到，返回默认值
    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'none'
    };

  } catch (error) {
    console.error('获取 Cursor 用户信息失败:', error);
    return {
      account: 'error',
      email: 'error@example.com',
      isLoggedIn: false,
      source: 'error'
    };
  }
}

/**
 * 从 VS Code 认证服务获取用户信息
 */
async function getAuthInfo(): Promise<CursorUserInfo> {
  try {
    // 获取所有可用的认证提供者
    const authProviders = await vscode.authentication.getSession('cursor', [], { createIfNone: false });
    
    if (authProviders) {
      return {
        account: authProviders.account.label || 'unknown',
        email: authProviders.account.id || 'unknown@example.com',
        displayName: authProviders.account.label,
        isLoggedIn: true,
        source: 'vscode-auth-cursor'
      };
    }

    // 尝试获取 GitHub 认证信息（Cursor 通常使用 GitHub 登录）
    const githubSession = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: false });
    if (githubSession) {
      return {
        account: githubSession.account.label || 'unknown',
        email: githubSession.account.id || 'unknown@example.com',
        displayName: githubSession.account.label,
        isLoggedIn: true,
        source: 'vscode-auth-github'
      };
    }

    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'vscode-auth'
    };
  } catch (error) {
    console.error('从认证服务获取用户信息失败:', error);
    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'vscode-auth-error'
    };
  }
}

/**
 * 从 Cursor 配置文件获取用户信息
 */
async function getCursorConfigInfo(): Promise<CursorUserInfo> {
  try {
    // 尝试从 Cursor 的配置目录获取
    const cursorConfigPaths = [
      path.join(os.homedir(), '.cursor', 'settings.json'),
      path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'settings.json'), // macOS
      path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json'), // Windows
      path.join(os.homedir(), '.config', 'Cursor', 'User', 'settings.json'), // Linux
    ];

    for (const configPath of cursorConfigPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configContent);
          
          // 查找用户相关的配置
          const userEmail = config['user.email'] || config['git.email'] || config['cursor.user.email'];
          const userName = config['user.name'] || config['git.name'] || config['cursor.user.name'];
          
          if (userEmail && userName) {
            return {
              account: userName,
              email: userEmail,
              displayName: userName,
              isLoggedIn: true,
              source: `cursor-config-${path.basename(path.dirname(configPath))}`
            };
          }
        } catch (parseError) {
          console.error(`解析配置文件失败 ${configPath}:`, parseError);
        }
      }
    }

    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'cursor-config'
    };
  } catch (error) {
    console.error('从 Cursor 配置文件获取用户信息失败:', error);
    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'cursor-config-error'
    };
  }
}

/**
 * 从环境变量获取用户信息
 */
function getEnvUserInfo(): CursorUserInfo {
  const user = process.env.USER || process.env.USERNAME || process.env.LOGNAME;
  const email = process.env.EMAIL || process.env.CURSOR_EMAIL || process.env.GITHUB_EMAIL;
  
  if (user && email) {
    return {
      account: user,
      email: email,
      displayName: user,
      isLoggedIn: true,
      source: 'environment-variables'
    };
  }

  return {
    account: 'unknown',
    email: 'unknown@example.com',
    isLoggedIn: false,
    source: 'environment-variables'
  };
}

/**
 * 从 VS Code 配置获取用户信息
 */
async function getConfigUserInfo(): Promise<CursorUserInfo> {
  try {
    // 尝试从 VS Code 配置获取
    const config = vscode.workspace.getConfiguration('cursor');
    const account = config.get<string>('account');
    const email = config.get<string>('email');

    if (account && email) {
      return {
        account: account,
        email: email,
        displayName: account,
        isLoggedIn: true,
        source: 'vscode-workspace-config'
      };
    }

    // 尝试从全局配置获取
    const globalConfig = vscode.workspace.getConfiguration('cursor');
    const globalAccount = globalConfig.get<string>('account');
    const globalEmail = globalConfig.get<string>('email');

    if (globalAccount && globalEmail) {
      return {
        account: globalAccount,
        email: globalEmail,
        displayName: globalAccount,
        isLoggedIn: true,
        source: 'vscode-global-config'
      };
    }

    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'vscode-config'
    };
  } catch (error) {
    console.error('从配置文件获取用户信息失败:', error);
    return {
      account: 'unknown',
      email: 'unknown@example.com',
      isLoggedIn: false,
      source: 'vscode-config-error'
    };
  }
}

/**
 * 从系统用户信息获取
 */
function getSystemUserInfo(): CursorUserInfo {
  try {
    // 使用环境变量作为备选方案，避免 os.userInfo() 的兼容性问题
    const username = process.env.USER || process.env.USERNAME || process.env.LOGNAME;
    if (username) {
      return {
        account: username,
        email: `${username}@${os.hostname()}.local`,
        displayName: username,
        isLoggedIn: true,
        source: 'system-user-info'
      };
    }
  } catch (error) {
    console.error('从系统用户信息获取失败:', error);
  }

  return {
    account: 'unknown',
    email: 'unknown@example.com',
    isLoggedIn: false,
    source: 'system-user-info'
  };
}

/**
 * 显示用户信息
 */
export async function showCursorUserInfo(): Promise<void> {
  const userInfo = await getCursorUserInfo();
  
  if (userInfo.isLoggedIn) {
    const message = `Cursor 用户信息:\n账号: ${userInfo.account}\n邮箱: ${userInfo.email}\n来源: ${userInfo.source}`;
    vscode.window.showInformationMessage(message, { modal: false });
  } else {
    vscode.window.showWarningMessage(
      '未检测到 Cursor 登录信息，请先登录 Cursor',
      { modal: false }
    );
  }
}

/**
 * 获取用户信息的详细信息（用于日志输出）
 */
export function getUserInfoForLog(): string {
  const user = process.env.USER || process.env.USERNAME || process.env.LOGNAME || 'unknown';
  const email = process.env.EMAIL || process.env.CURSOR_EMAIL || process.env.GITHUB_EMAIL || 'unknown@example.com';
  const home = process.env.HOME || process.env.USERPROFILE || 'unknown';
  const hostname = require('os').hostname();
  
  return `用户: ${user}, 邮箱: ${email}, 主目录: ${home}, 主机名: ${hostname}`;
}

/**
 * 获取所有可能的用户信息源
 */
export async function getAllUserInfoSources(): Promise<{ [key: string]: CursorUserInfo }> {
  const sources: { [key: string]: CursorUserInfo } = {};
  
  try {
    sources['auth'] = await getAuthInfo();
    sources['cursor-config'] = await getCursorConfigInfo();
    sources['env'] = getEnvUserInfo();
    sources['vscode-config'] = await getConfigUserInfo();
    sources['system'] = getSystemUserInfo();
  } catch (error) {
    console.error('获取所有用户信息源失败:', error);
  }
  
  return sources;
}
