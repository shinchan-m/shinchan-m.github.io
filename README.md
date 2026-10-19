# 🌸 MJC no Gakushuu Note

> Java 后端实习精进路线 · 二次元樱花主题

**线上地址：https://shinchan-m.github.io**

## 这是什么

一个记录 Java 后端实习备战过程的个人博客：14 周冲刺计划、技能树、面试核心 10 题、2026 就业市场数据，外加几篇技术长文。

- 🎓 江南大学（211）· 计算机 2025 级
- 🎯 目标：2027 年第一份日常实习
- 📅 14 周冲刺计划逐周拆解
- 🤖 AI Agent 差异化竞争策略

## 技术栈

纯 HTML5 + CSS3 + 原生 JavaScript，**零第三方依赖**，直接推 GitHub Pages 就能上线。

- 樱花花瓣 canvas 动画（DPR 适配，切后台自动暂停）
- IntersectionObserver 滚动淡入
- CSS 自定义属性驱动的亮/暗双主题
- 响应式，手机端可用

## ✨ 站点特效

所有特效都在 `app.js` 顶部的 `FX` 开关里，不想要哪个改成 `false` 即可：

| 开关 | 效果 |
|---|---|
| `sakura` | 背景樱花飘落 |
| `clickBurst` | 点击迸发爱心 + 樱花瓣 |
| `fireworks` | 点击烟花粒子（樱花配色） |
| `cursor` | 自定义樱花鼠标指针（内联 SVG，不依赖 .cur 文件） |
| `typewriter` | 首页 hero 区彩色打字机座右铭 |
| `funnyTitle` | 切走标签页时标题变「🥀 樱花都谢了…你去哪了」，favicon 同步变🥀 |
| `tilt` | 卡片 3D 倾斜跟随鼠标 |
| `backToTop` | 回到顶部按钮，外圈是阅读进度环 |
| `readingBar` | 文章页顶部阅读进度条 |
| `codeCopy` | 代码块一键复制 |
| `themeToggle` | 导航栏主题切换按钮（☀️ 亮 → 🌙 暗 → 🌸 跟随系统） |
| `easterEgg` | 彩蛋：键盘敲下 `sakura`，触发樱花暴雨 + 全屏烟花 |
| `waifu` | 看板娘 live2d，**默认关闭**（原因见下） |

全站遵循 `prefers-reduced-motion`：系统开了「减少动态效果」就自动停掉所有动画。触屏设备自动关闭鼠标指针和卡片倾斜。

### 为什么看板娘默认是关的

`waifu` 打开后会从 jsdelivr 拉 `live2d-widget` 和模型文件，代价是：引入外部依赖（违背本站零依赖原则）、jsdelivr 在国内时通时不通、模型 500KB~2MB 拖慢首屏、它自带的对话框样式会和樱花主题打架。想开就把 `FX.waifu` 改成 `true`。

## 目录结构

```
shinchan-m.github.io/
├── index.html        # 主页（所有板块都在这一页）
├── style.css         # 樱花主题样式 + 特效组件样式
├── vars.css          # CSS 变量：亮色默认值 + [data-theme=dark] 覆盖
├── app.js            # 全部交互与特效，含 FX 开关
├── .nojekyll         # 告诉 GitHub Pages 别走 Jekyll 构建
└── posts/            # 文章页
    ├── windows-docker-linux-mysql.html
    ├── java-roadmap-14-weeks.html
    ├── job-market-2026-truth.html
    ├── ai-agent-differentiation.html
    └── hashmap-source-analysis.html
```

## 部署

推到 `shinchan-m.github.io` 仓库的 `main` 分支即可：

```bash
git add .
git commit -m "update"
git push origin main
```

然后在仓库 Settings → Pages 里把 Source 设为 `main` 分支根目录。

## 发新文章

`D:\博客\build\build_post.py` 可以把 Markdown 转成套用本站样式的文章页：

```bash
pip install markdown
python D:\博客\build\build_post.py 你的文章.md 输出文件名.html "文章标题" "一句话简介" 2026-10-19
```

生成后记得回 `index.html` 的「博客文章」区加一张卡片。

脚本用 UTF-8 读写，**不要**再用会以 ASCII/Latin-1 落盘的工具处理这些文件 —— 本站曾有 3 篇文章因为编码问题，中文全部变成了 `?`。

---

Built with 💖 in Wuxi
