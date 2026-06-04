import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	plugins: [react(), tsconfigPaths()],
	test: {
		environment: 'jsdom',
		globals: false,
		include: ['**/*.test.{ts,tsx,mts,mjs}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			exclude: [
				'.next/**',
				'coverage/**',
				'node_modules/**',
				'**/*.config.*',
				'**/components/ui/**',
			],
		},
	},
});
