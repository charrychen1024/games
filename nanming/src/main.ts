import './ui/style.css';
import { App } from './ui/app';

const app = new App();
// 新版上线后旧页面取不到已换名的资源：提示刷新，而不是报一串英文错误
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  app.toast('游戏已更新，请刷新页面后继续（读“自动存档”即可接着玩）', 'info', 'alert');
});
