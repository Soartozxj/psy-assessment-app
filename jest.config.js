export default {
  // 测试环境：jsdom（模拟浏览器环境）
  testEnvironment: 'jsdom',

  // 测试文件匹配模式
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],

  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // 模块名称映射（用于模拟模块）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },

  // 测试超时时间（毫秒）
  testTimeout: 10000,

  // 慢速测试阈值（毫秒）
  slowTestThreshold: 1000,

  // 是否显示覆盖率报告
  coverageProvider: 'v8',

  // 排除文件
  coveragePathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '\\.min\\.js$'],

  // 测试前设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 是否自动模拟 node_modules
  automock: false,

  // 是否清除 mock 状态
  restoreMocks: true,

  // 是否显示详细测试信息
  verbose: true
};
