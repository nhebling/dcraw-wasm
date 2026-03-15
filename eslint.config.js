import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	{
		ignores: ['node_modules/**', 'bin/**', 'dist/**', 'demo/bin/**', 'src/lib/**', 'test-resources/**'],
	},
	js.configs.recommended,
	eslintConfigPrettier,
	{
		files: ['**/*.js'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
			},
		},
		rules: {
			'no-inner-declarations': 'off',
		},
	},
];
