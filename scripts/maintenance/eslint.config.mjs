// ESLint Flat Config — 星蓝心镜项目
// 详见 https://eslint.org/docs/latest/use/configure/configuration-files-new

import globals from 'globals';

export default [
  {
    ignores: [
      'deploy/**',
      'node_modules/**',
      '**/*.bak*',
      '**/*.bak.*',
      'generated-images/**',
      'cloudbase-run/node_modules/**',
      '**/shared-data.js',
      '**/default-prompts.js',
      '.codebuddy/**',
      'backup/**'
    ]
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        // 微信小程序全局变量
        wx: 'readonly',
        // 项目自注册全局变量
        window: 'readonly',
        document: 'readonly',
        // 项目内部全局变量 (通过 window.xxx 注册)
        CloudAPI: 'readonly',
        CloudData: 'readonly',
        ScoringEngine: 'readonly',
        DataMonitor: 'readonly',
        AssetStorage: 'readonly',
        SharedData: 'readonly',
        // scoring-engine.js 内部函数/变量
        SCALES: 'readonly',
        _doWebViewBack: 'readonly',
        _collectSpecialScore: 'readonly',
        _levelTargets: 'readonly',
        // 测试文件全局
        page: 'readonly',
        goBack: 'readonly'
      }
    },
    rules: {
      /* ===== 错误预防 ===== */
      'no-undef': 'warn',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-duplicate-imports': 'warn',

      /* ===== 安全 ===== */
      'no-eval': 'warn',
      'no-implied-eval': 'warn',
      'no-new-func': 'warn',
      'no-script-url': 'warn',

      /* ===== 最佳实践 ===== */
      eqeqeq: ['warn', 'always'],
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-trailing-spaces': 'warn',
      'no-multi-spaces': 'warn',
      curly: ['warn', 'all'],
      'default-case': 'warn',
      'no-fallthrough': 'error',

      /* ===== 代码质量 ===== */
      complexity: ['warn', { max: 20 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines-per-function': [
        'warn',
        {
          max: 100,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      'max-params': ['warn', { max: 5 }],
      'no-duplicate-case': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      /* ===== 风格 ===== */
      semi: ['warn', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      'comma-dangle': ['warn', 'never'],
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
      'eol-last': ['warn', 'always']
    }
  }
];
