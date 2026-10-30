// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'src/generated/**', 'dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      curly: ['error', 'all'],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['if', 'try', 'return'] },
        { blankLine: 'always', prev: 'block-like', next: '*' },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@nestjs/*', '@prisma/*', 'express', 'class-validator', 'class-transformer', '**/generated/**', '**/repository/**', '**/service/**', '**/delivery/**', '**/core/**'],
          message: 'Domain contracts must not depend on infrastructure or outer layers.',
        }],
      }],
    },
  },
  {
    files: ['src/modules/*/service/auth.service.ts', 'src/modules/*/service/auth.types.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@nestjs/*', '@prisma/*', 'express', '**/generated/**', '**/repository/**', '**/delivery/**', '**/core/**'],
          message: 'Use cases must depend on domain contracts, not concrete adapters or HTTP DTOs.',
        }],
      }],
    },
  },
);
