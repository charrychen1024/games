/* 查找 Playwright：依次尝试 PLAYWRIGHT_CORE 环境变量、项目依赖 playwright-core / playwright、
 * 本机 Homebrew 下 agent-browser 自带的 playwright-core。都找不到时给出安装提示。 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const candidates = [
  process.env.PLAYWRIGHT_CORE,
  'playwright-core',
  'playwright',
  '/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core',
].filter(Boolean);
let pw = null;
for (const c of candidates) { try { pw = require(c); break; } catch { /* 试下一个 */ } }
if (!pw) {
  console.error('找不到 Playwright。请先安装：npm i -D playwright-core && npx playwright-core install chromium\n或设置 PLAYWRIGHT_CORE=<playwright-core 所在目录>。');
  process.exit(2);
}
export default pw;
