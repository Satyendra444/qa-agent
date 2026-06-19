import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@agents': resolve(__dirname, 'src/agents'),
      '@mcp': resolve(__dirname, 'src/mcp'),
      '@api': resolve(__dirname, 'src/api'),
      '@logging': resolve(__dirname, 'src/logging'),
      '@evals': resolve(__dirname, 'src/evals'),
      '@db': resolve(__dirname, 'src/db'),
      '@reports': resolve(__dirname, 'src/reports'),
      '@dashboards': resolve(__dirname, 'src/dashboards'),
    },
  },
  test: {
    // Global test settings shared by all projects
    globals: true,
    reporters: ['verbose'],

    projects: [
      // ----------------------------------------------------------------
      // Unit test project — fast, no I/O, no Docker required
      // ----------------------------------------------------------------
      {
        extends: true,
        test: {
          name: 'unit',
          include: [
            'src/**/*.test.ts',
            'tests/unit/**/*.test.ts',
          ],
          exclude: [
            'tests/integration/**',
            'node_modules/**',
          ],
          environment: 'node',
          globals: true,
          coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            reportsDirectory: 'coverage/unit',
            include: ['src/**/*.ts'],
            exclude: [
              'src/**/*.test.ts',
              'src/**/*.spec.ts',
              'src/**/types.ts',
              'src/**/config.ts',
              'dist/**',
            ],
            thresholds: {
              statements: 80,
              branches: 80,
              functions: 80,
              lines: 80,
            },
          },
        },
      },

      // ----------------------------------------------------------------
      // Integration test project — requires Docker Compose services
      // ----------------------------------------------------------------
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['node_modules/**'],
          environment: 'node',
          globals: true,
          // Integration tests connect to real services — allow longer timeouts
          testTimeout: 60_000,
          hookTimeout: 30_000,
          // Run integration tests sequentially to avoid connection exhaustion
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
          coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: 'coverage/integration',
          },
        },
      },
    ],
  },
});
