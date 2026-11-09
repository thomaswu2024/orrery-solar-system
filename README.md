# ORRERY · 太阳系天文台

**🌐 在线体验：<https://thomaswu2024.github.io/orrery-solar-system/>**

一个基于 **React 19 + TypeScript + Vite + Three.js / React Three Fiber** 的高精度交互式太阳系模拟器，
可直接部署到 GitHub Pages，任何人可通过浏览器实时访问与操作。

> 34 个天体 · 双尺度模式 · 轨道相机 / 自由飞行 · 开普勒解析解 · 速度矢量与希尔球可视化

## 特性

- **开普勒解析轨道**：太阳、8 大行星、5 颗矮行星、20 颗卫星（含月球、伽利略卫星、土卫、天卫、海卫一、卡戎等）。
  采用 JPL 1800–2050 近似轨道根数（J2000 历元），含每世纪变率，支持任意时刻反演与外推。
- **双尺度模式**
  - `真实比例`：距离与半径严格 1:1（太阳 695,700 km 与冥王星轨道同框），行星将缩成亚像素光点——真实如此。
  - `教学比例`：距离按 `log` 非线性压缩、半径按幂律缩放，内行星与外行星可同时辨认。
- **两种探索方式**
  - 轨道相机：拖拽旋转、滚轮缩放、双击贴近、锁定并跟随选中天体。
  - 自由飞行：WASD / 方向键推进，Q/E 升降，Shift 加速、Alt 减速，鼠标视角锁定，滚轮调节巡航速度。
- **科学可视化层**（可独立开关）：轨道椭圆、运动轨迹、未来预测轨迹（虚线）、速度矢量、希尔球（引力影响范围）、
  小行星带、柯伊伯带、黄道网格。
- **高精度读数**：实时轨道速度、日心距、赤道自转速度、公转/自转周期、偏心率、倾角、转轴倾角、
  表面重力、逃逸速度、平均温度、质量、卫星数等。
- **仿真时钟**：1× ~ 100,000× 时间流速、暂停 / 倒放 / 回到当前时刻，对数速度滑杆与预设倍率。
- **工程细节**：浮动原点（floating origin）避免行星际尺度下的浮点抖动、对数深度缓冲、
  屏幕空间 LOD（远处卫星自动隐藏）、轨道/轨迹解析式缓存、实例化小行星带、ACES 色调映射 + Bloom / Vignette。

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物输出到 dist/
npm run preview  # 预览生产构建
```

## 部署到 GitHub Pages

仓库内置 `.github/workflows/pages.yml`：推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 `gh-pages` 分支。

- 站点地址：`https://thomaswu2024.github.io/orrery-solar-system/`
- 若使用项目子路径，`vite.config.ts` 中的 `base: './'` 已保证资源以相对路径加载。
- 也可手动发布：`bash scripts/deploy-pages.sh`（本地构建后用 SSH 推送 `gh-pages`）。

## 目录结构

```
src/
  data/bodies.ts     天体数据（轨道根数 + 物理参数）
  sim/               kepler.ts / scaling.ts / runtime.ts / camera.ts
  scene/             场景组件（环境、天体、轨道层、动力学层、光带层、输入）
  ui/                面板与覆盖层（目录、信息、时间轴、设置、标签）
  state/store.ts     zustand 全局状态
scripts/
  gen-textures.mjs   程序化生成卫星贴图（pngjs + 值噪声）
  deploy-pages.sh    一键发布到 GitHub Pages
```

## 数据来源

- 轨道根数：JPL Solar System Dynamics（近似根数，1800–2050 有效）。
- 物理参数：NASA Planetary Fact Sheet / IAU 2015 公历。
- 纹理：Solar System Scope（CC BY 4.0）公开贴图；部分卫星贴图由本地脚本程序化生成。

> 本项目为天文学科普与可视化用途，非 NASA / IAU 官方产品。
