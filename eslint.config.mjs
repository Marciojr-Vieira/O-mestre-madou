import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['node_modules/**', '**/.next/**', '.tools/**', '.data/**', '.netlify-api/**', '**/.netlify/**', 'output/**', 'apps/web/next-env.d.ts'] }, ...tseslint.configs.recommended, {
  rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] }
});
