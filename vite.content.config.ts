import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 内容脚本必须打包成单个 IIFE，不能使用 ES import。
// CSS 一并 inline 进 JS，运行时用 adoptedStyleSheets 注入，避免 manifest 里再声明一份 css 路径。
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'ClaudeVoyager',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        // 把样式文件命名固定一下，方便 manifest 中引用。
        assetFileNames: (asset) => {
          if (asset.name?.endsWith('.css')) return 'content.css';
          return 'assets/[name][extname]';
        },
      },
    },
    cssCodeSplit: false,
    target: 'es2022',
    minify: false,
  },
});
