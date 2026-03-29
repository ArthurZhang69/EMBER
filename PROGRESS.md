# 🔥 项目推进记录
### EMBER — Earth Monitoring of Burn Exposure Risk
### CASA0025 Group Project | UCL CASA

> 更新方式：每次完成任务后在对应项打勾 `[x]`，并在备注栏填写完成日期或说明。

---

## 📊 整体进度

| 模块 | 总任务 | 已完成 | 进度 |
|---|---|---|---|
| 🔵 Preprocessing | 23 项 | 0 | ⬜⬜⬜⬜⬜ 0% |
| 🟡 Analysis | 23 项 | 0 | ⬜⬜⬜⬜⬜ 0% |
| 🔴 Visualisation | 31 项 | 0 | ⬜⬜⬜⬜⬜ 0% |
| 📋 文档 & 发布 | 9 项 | 0 | ⬜⬜⬜⬜⬜ 0% |
| **总计** | **86 项** | **0** | **0%** |

---

## Week 1 — 启动 & 数据验证
**目标：** 所有人对齐方向，环境配置完毕，数据层面全部跑通

### 环境配置
- [ ] 所有组员 GEE 账号审批通过 | 负责人：全员 | DDL: Day 1
- [ ] Cloud Project 创建（casa0025-wildfire）| 负责人：F | DDL: Day 1
- [ ] 所有组员加入 Cloud Project | 负责人：F | DDL: Day 2
- [ ] GitHub 仓库创建（CASA0025-Wildfire-Risk）| 负责人：F | DDL: Day 2
- [ ] 所有组员接受 GitHub 仓库邀请 | 负责人：全员 | DDL: Day 2
- [ ] 分支建立（preprocessing / analysis / visualisation）| 负责人：F | DDL: Day 2
- [ ] README.md、CONTRIBUTIONS.md 推送至仓库 | 负责人：F | DDL: Day 2

### 数据验证
- [ ] 运行数据集验证代码，确认 6 个数据集全部可加载 | 负责人：A、B | DDL: Day 3
- [ ] 截图保存验证结果，上传至 GitHub Issues 或 Wiki | 负责人：A | DDL: Day 3

### 分析设计
- [ ] 确认 WRI 公式和默认权重 | 负责人：C、D | DDL: Day 3
- [ ] 将公式写入 docs/methodology.md | 负责人：C | DDL: Day 4
- [ ] UI 线框图完成（手绘或 Figma）| 负责人：E、F | DDL: Day 7

### 代码初稿
- [ ] `01_data_import.js` 初稿完成 | 负责人：A | DDL: Day 5
- [ ] `02_cloud_masking.js` 初稿完成 | 负责人：A | DDL: Day 7

**✅ Week 1 检查点**
- [ ] 数据集全部可加载
- [ ] WRI 公式文档已确认
- [ ] 仓库结构建立完毕

---

## Week 2 — Preprocessing 完成 & Analysis 启动
**目标：** 预处理管线全部跑通，核心分析算法完成初版

### Preprocessing
- [ ] `01_data_import.js` 代码审查通过，合并至 main | 负责人：A | DDL: Day 9
- [ ] `02_cloud_masking.js` 代码审查通过，合并至 main | 负责人：A | DDL: Day 9
- [ ] `03_anomaly_calculation.js` 完成 | 负责人：B | DDL: Day 10
- [ ] `04_normalisation.js` 完成 | 负责人：B | DDL: Day 11
- [ ] Preprocessing → Analysis 数据格式交接确认 | 负责人：A、B → C、D | DDL: Day 11

### Analysis
- [ ] `05_risk_index.js` 初版完成，WRI 图层可生成 | 负责人：C | DDL: Day 12
- [ ] 用加州或澳大利亚作为测试区截图验证 | 负责人：C | DDL: Day 12
- [ ] `06_classification.js` 完成 | 负责人：C | DDL: Day 13

### Visualisation
- [ ] UI 控制面板基本结构搭建（占位版）| 负责人：F | DDL: Day 14
- [ ] 地图底图和基础图层配置 | 负责人：F | DDL: Day 14

**✅ Week 2 检查点**
- [ ] WRI 图层在测试区可正常生成
- [ ] 三色分级图层视觉合理
- [ ] UI 面板基础框架可显示

---

## Week 3 — 全模块集成 & UI 完善
**目标：** 所有模块联通，应用可端到端运行

### Analysis
- [ ] `07_zonal_stats.js` 完成，AOI 内面积统计输出正确 | 负责人：D | DDL: Day 16
- [ ] 大面积 AOI 超时问题处理完成 | 负责人：D | DDL: Day 17

### Visualisation
- [ ] `08_map_layers.js` 完成（色阶、图例、图层控制）| 负责人：F | DDL: Day 17
- [ ] `09_ui_panels.js` 完成（滑块、按钮、绘图工具全部可交互）| 负责人：F | DDL: Day 17
- [ ] `10_charts.js` 完成，图表随 AOI 动态更新 | 负责人：D、F | DDL: Day 18
- [ ] `11_inspector.js` 完成，点击地图显示像素值 | 负责人：E | DDL: Day 18

### 集成
- [ ] `main.js` 组装完成，所有模块联通 | 负责人：全员 | DDL: Day 19
- [ ] 端到端测试通过（完整流程跑通）| 负责人：全员 | DDL: Day 19
- [ ] Bug 清单建立，分配修复责任人 | 负责人：全员 | DDL: Day 20
- [ ] 所有 Bug 修复完成 | 负责人：全员 | DDL: Day 21

**✅ Week 3 检查点**
- [ ] 应用端到端可运行
- [ ] 无严重 Bug（应用不崩溃）
- [ ] 所有交互功能正常响应

---

## Week 4 — 发布 & Presentation
**目标：** 应用上线，Presentation 排练完毕

### 发布
- [ ] GEE App 发布，获得公开链接 | 负责人：F | DDL: Day 22
- [ ] `index.html` 完成，嵌入 GEE App | 负责人：F | DDL: Day 23
- [ ] GitHub Pages 部署，获得展示页链接 | 负责人：F | DDL: Day 23

### 代码收尾
- [ ] 所有 `.js` 文件注释覆盖率 >80% | 负责人：全员 | DDL: Day 24
- [ ] README 更新（填入 App 链接 + 展示页链接 + 截图）| 负责人：F | DDL: Day 24
- [ ] 最终代码审查，确保 GitHub commit 记录清晰 | 负责人：全员 | DDL: Day 24

### Presentation
- [ ] PPT 初稿完成 | 负责人：全员 | DDL: Day 25
- [ ] 第一次排练（问题定义 + 演示 + 代码 walkthrough）| 负责人：全员 | DDL: Day 26
- [ ] 根据排练反馈修改 PPT | 负责人：全员 | DDL: Day 27
- [ ] **🎤 最终 Presentation** | 负责人：全员 | DDL: Day 28

**✅ Week 4 检查点**
- [ ] App 公开可访问，链接已更新至 README
- [ ] Presentation 排练至少 1 次
- [ ] 所有文件已提交至 GitHub

---

## 🐛 Bug 追踪

> 发现 Bug 时在此记录，修复后打勾。

| # | 描述 | 模块 | 负责人 | 状态 |
|---|---|---|---|---|
| — | *(Week 3 集成后填入)* | — | — | — |

---

## 📎 重要链接

> 随项目推进逐步填入。

| 资源 | 链接 |
|---|---|
| GitHub 仓库 | *(建立后填入)* |
| GEE Code Editor（团队脚本）| *(建立后填入)* |
| GEE App | *(发布后填入)* |
| GitHub Pages 展示页 | *(部署后填入)* |
| UI 线框图 | *(Week 1 完成后填入)* |
| 课程主页 | https://oballinger.github.io/CASA0025 |

---

## 📝 会议记录

> 每次小组会议后在此简要记录决定事项。

### Week 1 会议
- 日期：
- 参与人：
- 主要决定：
  -
  -

### Week 2 会议
- 日期：
- 参与人：
- 主要决定：
  -
  -

### Week 3 会议
- 日期：
- 参与人：
- 主要决定：
  -
  -

### Week 4 会议
- 日期：
- 参与人：
- 主要决定：
  -
  -

---

*最后更新：\_\_\_\_\_\_  |  CASA0025 Group Project  |  UCL CASA*
