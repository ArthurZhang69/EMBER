<p align="center">
  <img src="EMBER_LOGO.svg" width="360" alt="EMBER"/>
</p>

# 👥 Team Contributions & Project Plan
### EMBER — Earth Monitoring of Burn Exposure Risk
### CASA0025 Group Project | UCL Centre for Advanced Spatial Analysis

---

## 📌 项目简介

### 项目名称
**EMBER — Earth Monitoring of Burn Exposure Risk（地球野火暴露风险监测系统）**

### 课程背景
本项目为 UCL CASA0025（Building Spatial Applications with Big Data）课程 Group Project 作业，占最终成绩的 70%，分为应用开发（50%）和小组展示（20%）两部分。

### 项目背景
在气候变化背景下，野火的频率与强度持续上升，对生态系统、基础设施和人类社区造成严重威胁。有效的野火管理高度依赖于在火灾季节到来之前准确识别高风险地带，以便提前部署消防资源、发布预警。

然而现有工具存在明显局限：地理覆盖范围有限（多为美国本土）、不支持交互式探索、非专业人员难以使用。本应用旨在解决上述问题，提供一个**全球适用、交互友好、基于云端卫星数据**的野火风险评估平台。

### 核心功能
用户可在地图上自定义感兴趣区域（AOI），选择分析时间窗口，调整各风险因子的权重，实时生成并查看该区域的综合野火风险指数（Wildfire Risk Index, WRI）地图，并以高 / 中 / 低三级风险进行分级可视化。

### 目标用户
**主要用户：** 地方政府应急管理部门及林业管理机构——在火灾季节前识别高危地带，合理分配消防资源。

**次要用户：** 环境研究人员、新闻记者及教育工作者——用于区域野火风险的比较分析与科普展示。

### 技术平台
| 组件 | 技术 |
|---|---|
| 核心分析与地图 | Google Earth Engine（JavaScript API）|
| 数据来源 | GEE 公共数据目录（MODIS、ERA5、CHIRPS、SRTM）|
| 应用发布 | GEE App（`xxx.users.earthengine.app`）|
| 项目展示页 | HTML + GitHub Pages（iframe 嵌入 GEE App）|
| 版本管理 | GitHub |

### 评分结构对照

| 评分维度 | 权重 | 本项目对应策略 |
|---|---|---|
| 高级数据分析方法 | 30% | 多因子加权 WRI 合成、历史火点核密度、气候异常值计算 |
| 交互式 UI 质量 | 30% | AOI 绘图、权重滑块、时间选择器、点击检查器、动态图表 |
| 应用目的清晰度 | 30% | 明确的问题定义、真实用户群体、具体使用场景 |
| 设计美观性 | 10% | 色阶设计、图例、面板布局、HTML 展示页 |

### 相关链接
| 资源 | 链接 |
|---|---|
| GEE 应用 | *(部署后填入)* |
| GitHub 仓库 | *(建立后填入)* |
| HTML 展示页 | *(GitHub Pages 部署后填入)* |
| 课程主页 | https://oballinger.github.io/CASA0025 |

---

## 团队角色总览

> 评估要求：每位组员需在 GitHub 上通过 commit 记录体现对技术工作的实质性贡献，commit 信息需清晰描述所做的工作。

| 组员 | 主要角色 | 跨角色贡献 | 负责文件 |
|---|---|---|---|
| **组员 A** | 🔵 Preprocessing | — | `01_data_import.js`, `02_cloud_masking.js` |
| **组员 B** | 🔵 Preprocessing | 🟡 Analysis（支援） | `03_anomaly_calculation.js`, `04_normalisation.js` |
| **组员 C** | 🟡 Analysis | — | `05_risk_index.js`, `06_classification.js` |
| **组员 D** | 🟡 Analysis | 🔴 Visualisation（支援） | `07_zonal_stats.js`, `10_charts.js` |
| **组员 E** | 🔴 Visualisation | 🟡 Analysis（支援） | `11_inspector.js` |
| **组员 F** | 🔴 Visualisation | 🔵 Preprocessing（支援） | `08_map_layers.js`, `09_ui_panels.js`, `index.html`, `README.md` |

---

## 每人具体任务清单

---

### 🔵 组员 A — Preprocessing I（数据导入与云掩膜）

**主要职责：** 建立整个应用的数据基础，确保所有数据集正确加载、过滤和预处理

**具体任务：**

- [ ] `01_data_import.js`
  - [ ] 导入 MODIS NDVI (`MODIS/061/MOD13Q1`) 并按时间窗口过滤
  - [ ] 导入 MODIS LST (`MODIS/061/MOD11A1`) 并按时间窗口过滤
  - [ ] 导入 FIRMS 火点数据 (`FIRMS`)
  - [ ] 导入 CHIRPS 降水数据 (`UCSB-CHG/CHIRPS/DAILY`)
  - [ ] 导入 ERA5-Land 风速数据 (`ECMWF/ERA5_LAND/DAILY_AGGR`)
  - [ ] 导入 SRTM 地形数据 (`USGS/SRTMGL1_003`)，计算坡度
  - [ ] 统一所有数据集坐标系（EPSG:4326）
  - [ ] 编写数据加载函数，接受用户 AOI 和时间窗口作为参数

- [ ] `02_cloud_masking.js`
  - [ ] 使用 MODIS QA band 对 NDVI 影像进行云掩膜
  - [ ] 使用 MODIS QA band 对 LST 影像进行云掩膜
  - [ ] 掩膜水体（使用 JRC Global Surface Water）
  - [ ] 掩膜永久冰雪区域
  - [ ] 对掩膜后影像生成季节性合成图（中位数合成）
  - [ ] 编写通用云掩膜函数并加注释

**预计工作量：** ~12 小时

**GitHub Commit 规范示例：**
```
feat: add MODIS NDVI data import with temporal filtering
feat: implement QA-based cloud masking for MODIS products
fix: correct coordinate system mismatch in CHIRPS import
docs: add inline comments to data import functions
```

---

### 🔵 组员 B — Preprocessing II（异常值计算与归一化）+ 🟡 Analysis 支援

**主要职责：** 计算各气候因子相对于历史基准的异常值，并将所有图层归一化到统一尺度

**具体任务：**

- [ ] `03_anomaly_calculation.js`
  - [ ] 计算 LST 相对于 2000–2020 长期均值的异常值
  - [ ] 计算降水相对于 90 天滚动均值的亏缺量（Precipitation Anomaly）
  - [ ] 计算 NDVI 相对于同期多年均值的偏差（植被干旱指数）
  - [ ] 测试异常值计算结果是否合理（与已知火灾年份对比）

- [ ] `04_normalisation.js`
  - [ ] 使用 min-max 归一化将所有因子压缩至 0–1 范围
  - [ ] 处理极值/离群值（99th percentile clip）
  - [ ] 确保坡度、风速等非异常值指标也完成归一化
  - [ ] 输出标准化后的多波段合成图像，供 Analysis 使用

- [ ] **跨角色支援（Analysis）：**
  - [ ] 协助组员 C 调试 WRI 加权合成逻辑
  - [ ] 验证归一化输出与风险指数输出的一致性

**预计工作量：** ~14 小时

**GitHub Commit 规范示例：**
```
feat: compute LST anomaly relative to 2000-2020 baseline
feat: implement 90-day rolling precipitation deficit calculation
feat: add min-max normalisation with 99th percentile clipping
test: validate anomaly outputs against 2019-20 Australian fire season
```

---

### 🟡 组员 C — Analysis I（风险指数计算与分级）

**主要职责：** 实现核心分析算法，将预处理输出合成为最终风险指数图层

**具体任务：**

- [ ] `05_risk_index.js`
  - [ ] 实现加权合成函数：`WRI = w₁·VDI + w₂·LST + w₃·PA + w₄·WS + w₅·SLOPE + w₆·HFD`
  - [ ] 接受来自 UI 滑块的动态权重参数（w₁–w₆）
  - [ ] 确保权重总和自动归一为 1
  - [ ] 实现历史火点密度（HFD）计算：火点核密度估计 + 归一化
  - [ ] 编写完整函数注释，说明每个参数含义

- [ ] `06_classification.js`
  - [ ] 基于 WRI 阈值（0.33 / 0.67）将连续指数分为三级
  - [ ] 生成离散分类图像（High=3, Medium=2, Low=1）
  - [ ] 输出每级风险区域的像素数量与面积统计
  - [ ] 编写分级结果验证逻辑（与 USDA/WRC/v0 美国基准数据对比）

**预计工作量：** ~14 小时

**GitHub Commit 规范示例：**
```
feat: implement weighted composite WRI calculation function
feat: add dynamic weight parameter handling from UI sliders
feat: classify WRI into High/Medium/Low risk zones
test: validate classification against USDA WRC reference dataset
```

---

### 🟡 组员 D — Analysis II（空间统计）+ 🔴 Visualisation 支援

**主要职责：** 在用户定义的区域内计算汇总统计，并将结果传递给图表模块

**具体任务：**

- [ ] `07_zonal_stats.js`
  - [ ] 计算用户 AOI 内各风险等级的面积（km²）和占比（%）
  - [ ] 实现 AOI 内 WRI 均值、最大值、分布直方图的计算
  - [ ] 输出结构化的统计结果对象，供图表模块调用
  - [ ] 处理 AOI 跨越大面积时的计算超时问题（分块处理或降分辨率）
  - [ ] 计算每个因子在 AOI 内的贡献度排名（辅助用户理解风险成因）

- [ ] **跨角色支援（Visualisation）：**
  - [ ] 与组员 E 对接，确保统计输出格式与图表渲染格式一致
  - [ ] 协助完成 `10_charts.js` 中的风险比例图

**预计工作量：** ~12 小时

**GitHub Commit 规范示例：**
```
feat: implement zonal statistics for user-defined AOI
feat: calculate per-factor contribution scores within AOI
feat: add chunked processing for large AOI computation
fix: resolve timeout issue for AOIs larger than 50,000 km²
```

---

### 🔴 组员 E — Visualisation I（点击检查器）+ 🟡 Analysis 支援

**主要职责：** 实现像素级点击交互功能，并协助 Analysis 模块的统计输出对接

**具体任务：**

- [ ] `11_inspector.js`
  - [ ] 实现地图点击事件监听
  - [ ] 点击任意像素后显示该位置的 WRI 分值和各因子分值
  - [ ] 显示坐标信息（经纬度）
  - [ ] 显示历史该位置是否有过火点记录
  - [ ] 设计结果展示 Panel 样式
  - [ ] 实现检查器面板的显示/隐藏切换

- [ ] **跨角色支援（Analysis）：**
  - [ ] 与组员 D 对接，确保 `07_zonal_stats.js` 统计输出格式与检查器 Panel 兼容
  - [ ] 协助组员 D 测试空间统计结果的准确性（与手动计算对比验证）
  - [ ] 参与 `main.js` 集成测试，负责 Inspector 模块的端到端调试

**预计工作量：** ~10 小时

**GitHub Commit 规范示例：**
```
feat: implement click inspector panel with WRI and factor values
feat: add coordinate display on map click
feat: add historical fire point indicator in inspector
style: design inspector panel layout and toggle behaviour
test: validate inspector output against manual pixel sampling
```

---

### 🔴 组员 F — Visualisation II（地图样式 + UI 面板 + 文档）+ 🔵 Preprocessing 支援

**主要职责：** 主导整体界面设计，包括地图视觉层、控制面板、HTML 展示页及项目文档维护

**具体任务：**

- [ ] `08_map_layers.js`
  - [ ] 配置 WRI 连续渲染色阶（绿→黄→橙→红）
  - [ ] 配置分级风险图层（三色离散）并添加透明度控制
  - [ ] 添加历史火点图层（可选显示/隐藏）
  - [ ] 配置地图底图（Hybrid / Terrain / Satellite 可切换）
  - [ ] 设置图层控制面板（layer toggle）
  - [ ] 绘制颜色图例组件，保证风险等级清晰可读

- [ ] `09_ui_panels.js`
  - [ ] 构建左侧控制面板（Panel）布局
  - [ ] 实现 AOI 绘图工具（Drawing Tools）集成
  - [ ] 实现时间窗口选择器（月份/季节 Dropdown）
  - [ ] 实现六个因子权重滑块（Slider），含实时权重归一化显示
  - [ ] 实现"Run Analysis"按钮及加载状态提示
  - [ ] 添加应用标题、说明文字和数据来源链接

- [ ] `10_charts.js`（与组员 D 协作）
  - [ ] 实现 AOI 内风险面积比例饼图 / 条形图
  - [ ] 图表随 AOI 或参数变化动态更新

- [ ] `index.html`
  - [ ] 构建 GEE App 嵌入的 HTML 包装页
  - [ ] 添加项目说明、方法论摘要、团队信息和引用
  - [ ] 适配 GitHub Pages 部署

- [ ] **文档维护：**
  - [ ] 维护 `README.md` 和 `CONTRIBUTIONS.md`
  - [ ] 整理 `docs/methodology.md`（方法论详细说明）
  - [ ] 整理 `docs/data_dictionary.md`（变量定义）

- [ ] **跨角色支援（Preprocessing）：**
  - [ ] 协助组员 A 测试数据导入的边界情况（极地、海洋 AOI）

**预计工作量：** ~17 小时

**GitHub Commit 规范示例：**
```
feat: add continuous WRI colour ramp with green-red gradient
feat: implement discrete risk classification layer styling
style: design colour legend component with risk class labels
feat: build left control panel with AOI drawing tools
feat: add six factor weight sliders with auto-normalisation
feat: implement time window selector with seasonal presets
docs: update README with deployment instructions
feat: create HTML landing page with embedded GEE app iframe
```

---

## 📅 每周里程碑计划

> 项目共 **4 周**空窗期，时间紧凑，Preprocessing 与 Analysis 需并行推进。

---

### Week 1 — 启动 & 数据验证
**目标：** 所有人对齐方向，数据层面全部跑通

| 任务 | 负责人 | DDL | 交付物 |
|---|---|---|---|
| 建立 GitHub 仓库，初始化分支结构 | F | Day 2 | 仓库链接，分支建好 |
| 推送 README、CONTRIBUTIONS 文档 | F | Day 2 | 两份 `.md` 文件 |
| 验证所有 6 个 GEE 数据集可正常加载 | A、B | Day 3 | 各数据集截图确认 |
| 确认 WRI 公式和默认权重设置 | C、D | Day 3 | 公式文档（写进 `methodology.md`）|
| 完成 `01_data_import.js` 初稿 | A | Day 5 | 可运行，含注释 |
| 完成 `02_cloud_masking.js` 初稿 | A | Day 7 | 可运行，含注释 |
| UI 框架草图/线框图 | E、F | Day 7 | 手绘或 Figma 线框图 |

**周末检查点：** 数据全部加载成功 ✅ WRI 公式确认 ✅

---

### Week 2 — Preprocessing 完成 & Analysis 启动
**目标：** 预处理管线全部跑通，核心分析算法完成初版

| 任务 | 负责人 | DDL | 交付物 |
|---|---|---|---|
| 完成 `03_anomaly_calculation.js` | B | Day 10 | 降水/LST 异常值图层截图 |
| 完成 `04_normalisation.js` | B | Day 11 | 0–1 归一化输出图层 |
| Preprocessing → Analysis 数据交接 | A、B → C、D | Day 11 | 标准化多波段图像可用 |
| 完成 `05_risk_index.js`（WRI 合成）| C | Day 12 | WRI 图层截图（加州或澳大利亚测试区）|
| 完成 `06_classification.js`（分级）| C | Day 13 | 三色风险图层截图 |
| UI 控制面板基本结构搭建 | E、F | Day 14 | 面板可显示，滑块/按钮占位 |

**周末检查点：** WRI 图层生成成功 ✅ 分级图层视觉合理 ✅

---

### Week 3 — 全模块集成 & UI 完善
**目标：** 所有模块联通，应用可端到端运行

| 任务 | 负责人 | DDL | 交付物 |
|---|---|---|---|
| 完成 `07_zonal_stats.js` | D | Day 16 | AOI 内面积统计输出正确 |
| 完成 `08_map_layers.js`（图层样式）| E | Day 17 | 地图色阶、图例渲染正确 |
| 完成 `09_ui_panels.js`（控制面板）| F | Day 17 | 滑块/按钮/绘图工具可交互 |
| 完成 `10_charts.js`（风险比例图）| D、F | Day 18 | 图表随 AOI 动态更新 |
| 完成 `11_inspector.js`（点击检查）| E | Day 18 | 点击地图显示像素值 |
| **集成测试：** 组装 `main.js`，全流程跑通 | 全员 | Day 19 | `main.js` 可运行版本 |
| Bug 修复与性能优化 | 全员 | Day 21 | Bug 清单全部关闭 |

**周末检查点：** 应用端到端可运行 ✅ 无严重 Bug ✅

---

### Week 4 — 发布 & Presentation 准备
**目标：** 应用上线，Presentation 排练完毕

| 任务 | 负责人 | DDL | 交付物 |
|---|---|---|---|
| 发布 GEE App（公开链接）| F | Day 22 | `xxx.users.earthengine.app` 链接 |
| 完成 `index.html` 包装页，部署至 GitHub Pages | F | Day 23 | GitHub Pages 链接 |
| 最终代码审查，确保所有注释完整 | 全员 | Day 24 | 所有 `.js` 文件注释覆盖率 >80% |
| 更新 README（加入 App 链接、截图）| F | Day 24 | README 最终版 |
| 制作 Presentation PPT | 全员 | Day 25 | PPT 初稿 |
| 排练：问题定义 + 演示 + 代码 walkthrough | 全员 | Day 26 | 排练记录，问题 Q&A 准备 |
| **🎤 最终 Presentation** | 全员 | Day 28 | — |

**周末检查点：** App 公开可访问 ✅ Presentation 排练至少 1 次 ✅

---

## ⏱️ 预计工作量汇总

| 组员 | 主要角色 | 预计小时数 | 任务数量 |
|---|---|---|---|
| 组员 A | Preprocessing I | ~12 hrs | 15 项 |
| 组员 B | Preprocessing II + Analysis 支援 | ~14 hrs | 17 项 |
| 组员 C | Analysis I | ~14 hrs | 12 项 |
| 组员 D | Analysis II + Visualisation 支援 | ~12 hrs | 11 项 |
| 组员 E | Visualisation I + Analysis 支援 | ~10 hrs | 9 项 |
| 组员 F | Visualisation II（主导界面）+ 文档 | ~17 hrs | 22 项 |
| **总计** | | **~79 hrs** | **86 项** |

---

## 📌 GitHub 协作规范

### 分支策略
```
main          ← 稳定版本，只通过 Pull Request 合并
├── preprocessing   ← 组员 A、B 的工作分支
├── analysis        ← 组员 C、D 的工作分支
└── visualisation   ← 组员 E、F 的工作分支
```

### Commit 规范
所有 commit 信息使用以下前缀，方便评估者识别工作类型：

| 前缀 | 含义 |
|---|---|
| `feat:` | 新增功能 |
| `fix:` | 修复 Bug |
| `docs:` | 文档更新 |
| `test:` | 测试/验证 |
| `style:` | UI 样式调整 |
| `refactor:` | 代码重构（功能不变）|

### Pull Request 规则
- 每个功能模块完成后发起 PR，至少 **1 人 review** 后才能合并到 main
- PR 描述需说明：实现了什么、如何测试、截图或输出示例

---

*更新日期：2026年3月 | CASA0025 Group Project*
