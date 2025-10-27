// Build script for creating npm package from Deno module
// Run with: deno run -A scripts/build_npm.ts

import { build, emptyDir } from '@dnt/mod';
import denoJson from '../deno.json' with { type: 'json' };

await emptyDir('./npm');

await build({
  entryPoints: ['./type-router.ts'],
  outDir: './npm',
  shims: {
    deno: false,
    custom: [
      {
        package: {
          name: 'globalThis',
          version: '1.0.0',
        },
        globalNames: ['globalThis'],
      },
    ],
  },
  package: {
    name: '@itaylor/type-router',
    version: denoJson.version,
    description: denoJson.description,
    keywords: [
      'router',
      'routing',
      'spa',
      'single-page-application',
      'typescript',
      'type-safe',
      'navigation',
      'history',
      'hash-router',
      'frontend',
      'browser',
      'vanilla',
      'framework-agnostic',
      'zero-dependencies',
    ],
    license: 'MIT',
    author: 'itaylor',
    homepage: 'https://github.com/itaylor/type-router',
    repository: {
      type: 'git',
      url: 'https://github.com/itaylor/type-router.git',
    },
  },
  postBuild() {
    // Copy README and LICENSE to npm directory
    Deno.copyFileSync('README.md', 'npm/README.md');
    Deno.copyFileSync('LICENSE', 'npm/LICENSE');
    console.log('✅ README.md and LICENSE copied to npm directory');
  },
  compilerOptions: {
    target: 'ES2020',
    lib: ['ES2020', 'DOM'],
  },
  typeCheck: 'both',
  declaration: 'separate',
  scriptModule: false,
  test: false,
});

console.log('✅ npm package built successfully!');
console.log('📦 Package ready in ./npm directory');
console.log('\nTo publish:');
console.log('  cd npm');
console.log('  npm publish');
