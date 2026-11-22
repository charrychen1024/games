# 素材来源与授权

南明的画面与声音大多由代码实时生成。少量外部素材如下，均允许再分发。

| 素材 | 用途 | 来源 | 授权 |
|---|---|---|---|
| 图标（约 80 个） | 资源、命令、军情分类、兵种、战斗指令、地图徽章 | [game-icons.net](https://game-icons.net/)，作者 Lorc、Delapouite 等；经 npm 包 `@iconify-json/game-icons` 取得，由 `tools/build-icons.mjs` 抽取到 `src/ui/icons.ts` | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| 陆地轮廓 | 地图海岸线 | [Natural Earth](https://www.naturalearthdata.com/) 1:50m land，经 npm 包 `world-atlas` 取得，由 `tools/build-geo.mjs` 裁剪抽稀到 `src/data/geo-land.json` | 公有领域 |
| Phaser 3 | 战斗场景引擎（WebGL 渲染、粒子、补间、镜头、后期特效） | [phaser.io](https://phaser.io/)，npm 包 `phaser` | MIT |
| GSAP 3 | 界面动画（面板、卡片、标题、数字滚动） | [gsap.com](https://gsap.com/)，npm 包 `gsap` | GSAP Standard License（免费，可商用） |
| 字体 Noto Serif SC、Ma Shan Zheng | 正文与标题 | Google Fonts，运行时加载；离线时退回系统宋体、楷体 | SIL Open Font License 1.1 |

以下内容为原创，由代码生成：
- 地图城池标志（城郭、城楼、宫殿、港口、渡口、关隘）与飘动的旗帜
- 战场插画：天空、远山、草地、江河、树林、城墙城楼、城内屋舍；士兵、骑兵、火炮的贴图与动作
- 山形、海波、长城、纸纹
- 河道与运河（按 1644 年河道手工标点）
- 军旗、兵阵、战斗动画
- 全部音效（WebAudio 合成）

城池坐标、辖属与开局数据由本项目整理。学术地图集只用于核对，没有打包其图像或数据。
