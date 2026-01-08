//@ts-check

'use strict';

const path = require('path');
const WebpackObfuscator = require('webpack-obfuscator');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

// 检测是否为生产模式
const isProduction = process.env.NODE_ENV === 'production' || 
                      process.argv.includes('--mode=production') ||
                      process.argv.includes('production');

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
  plugins: [
    // 只在生产模式时启用代码混淆
    ...(isProduction ? [
      new WebpackObfuscator({
        // 混淆配置
        rotateStringArray: true, // 旋转字符串数组
        stringArray: true, // 使用字符串数组
        stringArrayCallsTransform: true, // 字符串数组调用转换
        stringArrayEncoding: ['base64'], // 字符串数组编码
        stringArrayIndexShift: true, // 字符串数组索引偏移
        stringArrayRotate: true, // 字符串数组旋转
        stringArrayShuffle: true, // 字符串数组洗牌
        stringArrayWrappersCount: 2, // 字符串数组包装器数量
        stringArrayWrappersChainedCalls: true, // 字符串数组包装器链式调用
        stringArrayWrappersParametersMaxCount: 4, // 字符串数组包装器参数最大数量
        stringArrayWrappersType: 'function', // 字符串数组包装器类型
        stringArrayThreshold: 0.75, // 字符串数组阈值
        transformObjectKeys: true, // 转换对象键
        unicodeEscapeSequence: false, // 禁用 Unicode 转义序列（保持可读性）
        // 排除某些标识符（VS Code API 相关）
        identifierNamesGenerator: 'hexadecimal', // 标识符名称生成器
        renameGlobals: false, // 不重命名全局变量（避免破坏 VS Code API）
        selfDefending: false, // 禁用自我保护（避免性能问题）
        compact: true, // 压缩代码
        controlFlowFlattening: false, // 禁用控制流扁平化（避免性能问题）
        deadCodeInjection: false, // 禁用死代码注入（避免文件过大）
        debugProtection: false, // 禁用调试保护（避免影响开发）
        debugProtectionInterval: 0, // 调试保护间隔
        disableConsoleOutput: false, // 不禁用 console 输出（保持日志功能）
        domainLock: [], // 不锁定域名
        forceTransformStrings: [], // 强制转换的字符串
        log: false, // 不输出日志
        numbersToExpressions: false, // 不将数字转换为表达式（避免性能问题）
        simplify: true, // 简化代码
        splitStrings: false, // 不分割字符串（避免性能问题）
        splitStringsChunkLength: 10, // 字符串分割块长度
      }, [
        // 排除的文件（不混淆）
        '**/node_modules/**',
        '**/dist/**'
      ])
    ] : [])
  ],
};
module.exports = [ extensionConfig ];