module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // 关闭 ESLint 对 Prettier 格式的强制提示，允许多种书写风格并存
    'prettier/prettier': 'off',
    // 要求花括号内保留空格（包含 import/export）
    'object-curly-spacing': ['warn', 'always'],
    // 关闭内联样式警告
    'react-native/no-inline-styles': 'off',
    // 设置最大行长度为200
    'max-len': ['warn', { code: 200 }],
    // 允许单行 if/else 不使用大括号
    curly: ['warn', 'multi-line'],
  },
};
