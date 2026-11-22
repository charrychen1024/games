# Game · 小游戏合集

作者：**一尾小石斑** · 许可证：[MIT](LICENSE)

**在线试玩**：<https://charrychen1024.github.io/games/>（打开即玩，需要电脑键盘）

这里放的是一个个独立的浏览器小游戏。每个游戏占一个文件夹，互不依赖，各自有自己的 README、启动脚本和测试。

所有游戏都是纯 HTML + JavaScript：
- **不需要安装依赖**，也不需要构建。
- **没有图片、音频素材**：画面和声音都由代码实时生成。

## 游戏列表

| 文件夹 | 游戏 | 类型 | 简介 |
|---|---|---|---|
| [`battle-city/`](battle-city/README.md) · [在线玩](https://charrychen1024.github.io/games/battle-city/) | **BATTLE CITY 90 · 坦克大战** | 动作射击 | 红白机《坦克大战》的复刻：35 个关卡、双人合作、关卡编辑器、无尽模式 |
| [`sanguo/`](sanguo/README.md) · [在线玩](https://charrychen1024.github.io/games/sanguo/) | **烽烟录 · 三国** | 回合制 RPG | 原创三国题材日式 RPG：全八部三十四章，从桃园结义一直到三分归晋，故事完整；通关后解锁番外「桃园一梦」；可随时存档 |

## 怎么玩

进入游戏的文件夹，运行 `./play.sh`。它会启动一个本地服务器，并自动打开浏览器：

```bash
cd battle-city && ./play.sh     # 坦克大战，默认端口 8099
cd sanguo && ./play.sh          # 烽烟录，默认端口 8088
```

两个游戏的默认端口不同，可以同时开着。按 `Ctrl+C` 结束。

需要的环境：
- [Node.js](https://nodejs.org/)：只用来起本地服务器和跑测试。没有 Node 也能直接双击 `index.html` 玩，但 Safari 在 `file://` 下可能存不住存档。
- 自动化测试用的是本机已安装的 Playwright。

## 目录结构

```
Game/
├── README.md          本文件：合集总览
├── index.html         GitHub Pages 首页：游戏列表
├── LICENSE            MIT 许可证
├── battle-city/       坦克大战
│   ├── README.md
│   ├── index.html
│   ├── play.sh
│   ├── package.json   npm run verify：关卡校验 + 端到端测试
│   ├── css/  js/
│   ├── tools/         本地服务器与测试脚本
│   └── screenshots/
└── sanguo/            烽烟录 · 三国
    ├── README.md
    ├── index.html
    ├── play.sh
    ├── package.json   npm test：地图校验 + 存档 + 全部章节主线测试
    ├── js/
    ├── tools/         本地服务器、截图与测试脚本
    └── screenshots/
```

## 新增一个游戏

1. 在 `Game/` 下新建一个文件夹，用英文小写加短横线命名，例如 `snake/`、`tower-defense/`。
2. 文件夹里至少要有这几样：
   - `index.html`
   - `play.sh`（一键启动）
   - `README.md`（怎么玩、操作、玩法、目录结构）
   - `tools/serve.js`（本地静态服务器）
3. 每个游戏选一个不同的默认端口，免得同时运行时冲突。
4. 在本文件的「游戏列表」和根目录 `index.html` 里各加一项。

游戏之间不共享代码。各自独立，复制、删除或单独发布某一个都很方便。
