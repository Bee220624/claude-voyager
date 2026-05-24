import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';

// 把 public/ 下的静态资源（manifest.json、icons 等）复制到 dist 根目录。
function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const publicDir = resolve(__dirname, 'public');
      const distDir = resolve(__dirname, 'dist');
      if (!existsSync(publicDir)) return;
      const copy = (srcDir: string, dstDir: string) => {
        mkdirSync(dstDir, { recursive: true });
        for (const entry of readdirSync(srcDir)) {
          const srcPath = resolve(srcDir, entry);
          const dstPath = resolve(dstDir, entry);
          if (statSync(srcPath).isDirectory()) copy(srcPath, dstPath);
          else copyFileSync(srcPath, dstPath);
        }
      };
      copy(publicDir, distDir);
    },
  };
}

// popup（HTML 入口）使用 ESM；内容脚本走 vite.content.config.ts 单独打包。
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // 内容脚本先 build，这里不能清空
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'es2022',
    minify: false,
  },
  plugins: [copyStaticAssets()],
});
