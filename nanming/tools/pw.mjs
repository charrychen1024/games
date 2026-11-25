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
// Playwright 自带的浏览器缺失（缓存被清理等）时，改用本机安装的 Google Chrome
const launch0 = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (opts = {}) => {
  try { return await launch0(opts); }
  catch (e) {
    if (!/Executable doesn't exist/.test(String(e?.message)) || opts.channel) throw e;
    console.error('（Playwright 自带浏览器缺失，改用本机 Chrome）');
    return launch0({ ...opts, channel: 'chrome' });
  }
};
export default pw;
