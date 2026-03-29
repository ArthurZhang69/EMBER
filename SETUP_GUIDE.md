# 🛠️ 项目实施详细步骤指南
### EMBER — Earth Monitoring of Burn Exposure Risk
### CASA0025 Group Project | UCL Centre for Advanced Spatial Analysis

---

## 目录

1. [GEE 账号注册与环境配置](#1-gee-账号注册与环境配置)
2. [GitHub 仓库初始化与协作流程](#2-github-仓库初始化与协作流程)
3. [GEE 代码结构与各模块如何写](#3-gee-代码结构与各模块如何写)
4. [如何发布为 GEE App 并嵌入 HTML](#4-如何发布为-gee-app-并嵌入-html)
5. [如何用 GitHub Pages 部署展示页](#5-如何用-github-pages-部署展示页)

---

## 1. GEE 账号注册与环境配置

### 1.1 注册 Google Earth Engine 账号

**每位组员都需要独立注册，不能共用一个账号。**

步骤：
1. 访问 https://earthengine.google.com
2. 点击右上角 **"Get Started"**
3. 用 Google 账号登录（建议用学校邮箱 `@ucl.ac.uk`）
4. 填写注册表单：
   - Project type → 选 **"Education / Research"**
   - Organization → 填 `University College London`
   - Intended use → 简述：`Group project for CASA0025 course, building a wildfire risk prediction application`
5. 提交后等待审批，通常 **1–2 个工作日**内通过
6. 收到批准邮件后，访问 https://code.earthengine.google.com 确认可以登录

> ⚠️ **提前注册！** Week 1 第一天就提交申请，审批可能需要几天时间。

---

### 1.2 熟悉 GEE Code Editor 界面

登录 Code Editor 后，界面分为四个区域：

```
┌─────────────────────────────────────────────────────┐
│  左侧面板                    │  右侧地图              │
│  - Scripts（你的代码）        │                       │
│  - Docs（API 文档）           │  ← 结果在这里显示     │
│  - Assets（上传的数据）       │                       │
├──────────────────────────────┤                       │
│  中间编辑器                  │                       │
│  ← 在这里写 JavaScript 代码  │                       │
├──────────────────────────────┤                       │
│  底部控制台                  │                       │
│  - Console（print 输出）      │                       │
│  - Inspector（地图点击信息）  │                       │
│  - Tasks（导出任务）          │                       │
└─────────────────────────────────────────────────────┘
```

---

### 1.3 创建 GEE Cloud Project

GEE 现在需要关联一个 Google Cloud Project 才能运行。

步骤：
1. 登录 https://console.cloud.google.com
2. 点击顶部项目下拉框 → **"New Project"**
3. 项目名称填：`casa0025-wildfire`
4. 点击 **"Create"**
5. 回到 GEE Code Editor，点击左上角头像 → **"Register a new Cloud project"**
6. 选择刚刚创建的 `casa0025-wildfire` 项目
7. 完成注册

> 📌 **只需一个人创建 Cloud Project，其他组员加入该项目即可**（在 Cloud Console 的 IAM 页面添加组员邮箱，赋予 Editor 权限）

---

### 1.4 验证数据集可访问

在 Code Editor 中运行以下代码，逐一验证所有数据集：

```javascript
// 验证 MODIS NDVI
var ndvi = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterDate('2023-06-01', '2023-09-01')
  .first();
print('MODIS NDVI:', ndvi);

// 验证 MODIS LST
var lst = ee.ImageCollection('MODIS/061/MOD11A1')
  .filterDate('2023-06-01', '2023-09-01')
  .first();
print('MODIS LST:', lst);

// 验证 CHIRPS
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterDate('2023-06-01', '2023-09-01')
  .first();
print('CHIRPS:', chirps);

// 验证 ERA5-Land
var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
  .filterDate('2023-06-01', '2023-09-01')
  .first();
print('ERA5-Land:', era5);

// 验证 SRTM
var srtm = ee.Image('USGS/SRTMGL1_003');
print('SRTM:', srtm);

// 验证 FIRMS 火点
var firms = ee.ImageCollection('FIRMS')
  .filterDate('2023-06-01', '2023-09-01')
  .first();
print('FIRMS:', firms);
```

点击 **Run**，如果 Console 里六个数据集都有输出，说明全部可用。

---

## 2. GitHub 仓库初始化与协作流程

### 2.1 创建仓库（由组员 F 负责）

1. 登录 GitHub，点击右上角 **"+"** → **"New repository"**
2. 填写信息：
   - Repository name：`CASA0025-Wildfire-Risk`
   - Description：`Global Wildfire Risk Prediction System — CASA0025 Group Project`
   - 设为 **Public**（评估需要公开访问）
   - 勾选 **"Add a README file"**
   - 选择 License：**MIT License**
3. 点击 **"Create repository"**

---

### 2.2 初始化仓库结构

在本地克隆仓库并创建文件夹结构：

```bash
# 克隆仓库
git clone https://github.com/你的用户名/CASA0025-Wildfire-Risk.git
cd CASA0025-Wildfire-Risk

# 创建文件夹结构
mkdir preprocessing analysis visualisation app docs

# 创建占位文件（避免空文件夹）
touch preprocessing/01_data_import.js
touch preprocessing/02_cloud_masking.js
touch preprocessing/03_anomaly_calculation.js
touch preprocessing/04_normalisation.js
touch analysis/05_risk_index.js
touch analysis/06_classification.js
touch analysis/07_zonal_stats.js
touch visualisation/08_map_layers.js
touch visualisation/09_ui_panels.js
touch visualisation/10_charts.js
touch visualisation/11_inspector.js
touch app/main.js
touch app/index.html
touch docs/methodology.md
touch docs/data_dictionary.md

# 把 README 和 CONTRIBUTIONS 放入根目录
# （将之前生成的文件内容复制进去）

# 提交初始结构
git add .
git commit -m "feat: initialise repository structure with all module placeholders"
git push origin main
```

---

### 2.3 邀请组员加入仓库

1. 进入仓库页面 → **Settings** → **Collaborators**
2. 点击 **"Add people"**
3. 搜索每位组员的 GitHub 用户名，发送邀请
4. 组员接受邀请后即可推送代码

---

### 2.4 创建各角色工作分支

```bash
# 组员 F 在本地创建三个分支并推送到远端
git checkout -b preprocessing
git push origin preprocessing

git checkout main
git checkout -b analysis
git push origin analysis

git checkout main
git checkout -b visualisation
git push origin visualisation
```

每位组员在自己负责的分支上工作：

```bash
# 组员 A/B 的操作
git checkout preprocessing
git pull origin preprocessing
# 编辑文件...
git add preprocessing/01_data_import.js
git commit -m "feat: add MODIS NDVI data import with temporal filtering"
git push origin preprocessing
```

---

### 2.5 合并代码到 main（Pull Request 流程）

当一个模块完成后：
1. 在 GitHub 网页上点击 **"Compare & pull request"**
2. Base 选 `main`，Compare 选你的分支
3. 填写 PR 描述：实现了什么、如何测试
4. 请另一位组员 Review
5. Review 通过后点 **"Merge pull request"**

---

### 2.6 保持本地代码最新

每次开始工作前先拉取最新代码：

```bash
git checkout preprocessing   # 切换到自己的分支
git pull origin preprocessing  # 拉取远端更新
git merge main               # 合并 main 的最新改动（如果有）
```

---

## 3. GEE 代码结构与各模块如何写

### 3.1 GEE Code Editor 与 GitHub 的关系

> ⚠️ **重要：** GEE Code Editor 不能直接连接 GitHub，需要手动同步。

推荐工作流程：
1. 在 **GEE Code Editor** 里开发和测试代码
2. 测试通过后，把代码**复制**到本地对应的 `.js` 文件
3. 通过 Git 推送到 GitHub

---

### 3.2 在 GEE Code Editor 中管理脚本

1. 登录 Code Editor
2. 左侧 **Scripts** 面板 → 点击 **"NEW"** → **"Repository"**
3. 命名为 `CASA0025-Wildfire`
4. 在 Repository 下为每个模块创建脚本文件：
   - `01_data_import`
   - `02_cloud_masking`
   - …以此类推

这样组员之间可以在 GEE 内共享脚本（通过 Repository 共享链接）。

---

### 3.3 各模块代码框架

#### 模块 01 — 数据导入（组员 A）

```javascript
// ============================================================
// 01_data_import.js
// 功能：导入并过滤所有数据集
// 输入：用户定义的 AOI 和时间窗口
// 输出：各数据集的 ImageCollection 或 Image
// 负责人：组员 A
// ============================================================

/**
 * 导入并过滤所有数据集
 * @param {ee.Geometry} aoi - 用户定义的感兴趣区域
 * @param {string} startDate - 开始日期，格式 'YYYY-MM-DD'
 * @param {string} endDate - 结束日期，格式 'YYYY-MM-DD'
 * @returns {Object} 包含所有数据集的对象
 */
function importDatasets(aoi, startDate, endDate) {

  // 1. MODIS NDVI（250m，16天合成）
  var ndvi = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .select('NDVI');

  // 2. MODIS 地表温度（1km，每日）
  var lst = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .select('LST_Day_1km');

  // 3. CHIRPS 降水（~5.5km，每日）
  // 注意：CHIRPS 覆盖范围为 60°N - 60°S
  var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .select('precipitation');

  // 4. ERA5-Land 风速（~11km，每日）
  // u_component_of_wind_10m 和 v_component_of_wind_10m 需合成风速
  var era5 = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .select(['u_component_of_wind_10m', 'v_component_of_wind_10m']);

  // 5. SRTM 地形（30m，静态）
  var srtm = ee.Image('USGS/SRTMGL1_003').select('elevation');
  var slope = ee.Terrain.slope(srtm).clip(aoi);

  // 6. FIRMS 历史火点（1km，每日，从 2000 年至今）
  var firms = ee.ImageCollection('FIRMS')
    .filterDate('2000-01-01', endDate)  // 取历史全部火点
    .filterBounds(aoi)
    .select('T21');

  return {
    ndvi: ndvi,
    lst: lst,
    chirps: chirps,
    era5: era5,
    slope: slope,
    firms: firms
  };
}

// 测试：使用加州作为测试区域
var testAOI = ee.Geometry.Rectangle([-122, 37, -119, 39]);
var data = importDatasets(testAOI, '2023-06-01', '2023-09-01');
print('数据集导入测试：', data.ndvi.size());
Map.addLayer(data.ndvi.mean(), {min: 0, max: 8000, palette: ['white', 'green']}, 'NDVI Test');
```

---

#### 模块 02 — 云掩膜（组员 A）

```javascript
// ============================================================
// 02_cloud_masking.js
// 功能：对 MODIS 数据进行云掩膜，生成季节合成图
// 负责人：组员 A
// ============================================================

/**
 * MODIS NDVI 云掩膜函数
 * 使用 SummaryQA band 过滤低质量像素
 */
function maskNDVI(image) {
  // SummaryQA: 0=好, 1=边缘, 2=雪/冰, 3=云
  var qa = image.select('SummaryQA');
  var mask = qa.lte(1);  // 只保留好和边缘质量
  return image.updateMask(mask);
}

/**
 * MODIS LST 云掩膜函数
 * 使用 QC_Day band 过滤低质量像素
 */
function maskLST(image) {
  var qc = image.select('QC_Day');
  // 提取最低两位（LST 数据质量位）
  var mask = qc.bitwiseAnd(3).lte(1);
  return image.updateMask(mask);
}

/**
 * 生成季节合成图（中位数）
 * @param {ee.ImageCollection} collection - 已掩膜的 ImageCollection
 * @returns {ee.Image} 中位数合成图
 */
function makeComposite(collection) {
  return collection.median();
}

// 使用示例
// var maskedNDVI = data.ndvi.map(maskNDVI);
// var ndviComposite = makeComposite(maskedNDVI);
```

---

#### 模块 03 — 异常值计算（组员 B）

```javascript
// ============================================================
// 03_anomaly_calculation.js
// 功能：计算各因子相对于历史基准的异常值
// 负责人：组员 B
// ============================================================

/**
 * 计算降水亏缺（Precipitation Anomaly）
 * 当前时段累计降水 vs 2000-2020 同期均值
 */
function calcPrecipAnomaly(chirps, aoi, startDate, endDate) {
  // 当前时段降水
  var currentPrecip = chirps.filterDate(startDate, endDate).sum();

  // 历史基准：2000-2020 同月份均值
  var months = ee.List.sequence(
    ee.Date(startDate).get('month'),
    ee.Date(endDate).get('month')
  );
  var baseline = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate('2000-01-01', '2020-12-31')
    .filter(ee.Filter.calendarRange(
      ee.Date(startDate).get('month'),
      ee.Date(endDate).get('month'),
      'month'
    ))
    .sum()
    .divide(20);  // 20年均值

  // 异常值 = 当前 - 基准（负值表示干旱，即高风险）
  var anomaly = currentPrecip.subtract(baseline);

  // 转为"干旱指数"：数值越高表示越干旱（风险越高）
  // 取负值并归零（正常降水不额外降低风险）
  return anomaly.multiply(-1).max(0).rename('precip_deficit');
}

/**
 * 计算 LST 异常（热浪指数）
 */
function calcLSTAnomaly(lst, startDate, endDate) {
  // 当前时段 LST 均值
  var currentLST = lst.filterDate(startDate, endDate).mean();

  // 历史基准：2000-2020 同期均值
  var baseline = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterDate('2000-01-01', '2020-12-31')
    .filter(ee.Filter.calendarRange(
      ee.Date(startDate).get('month'),
      ee.Date(endDate).get('month'),
      'month'
    ))
    .select('LST_Day_1km')
    .mean();

  return currentLST.subtract(baseline).rename('lst_anomaly');
}
```

---

#### 模块 04 — 归一化（组员 B）

```javascript
// ============================================================
// 04_normalisation.js
// 功能：将所有因子归一化到 0-1 范围
// 负责人：组员 B
// ============================================================

/**
 * Min-max 归一化（使用百分位裁剪处理极值）
 * @param {ee.Image} image - 待归一化的图像
 * @param {ee.Geometry} aoi - 计算统计范围
 * @param {number} minPct - 最小百分位（默认 2）
 * @param {number} maxPct - 最大百分位（默认 98）
 * @returns {ee.Image} 归一化后的图像（0-1）
 */
function normalise(image, aoi, minPct, maxPct) {
  minPct = minPct || 2;
  maxPct = maxPct || 98;

  // 计算 AOI 内的百分位值
  var percentiles = image.reduceRegion({
    reducer: ee.Reducer.percentile([minPct, maxPct]),
    geometry: aoi,
    scale: 1000,  // 1km 分辨率计算统计，速度更快
    maxPixels: 1e9
  });

  var bandName = image.bandNames().get(0);
  var minVal = ee.Number(percentiles.get(bandName.cat('_p' + minPct)));
  var maxVal = ee.Number(percentiles.get(bandName.cat('_p' + maxPct)));

  // 归一化：(x - min) / (max - min)，裁剪到 0-1
  return image
    .subtract(minVal)
    .divide(maxVal.subtract(minVal))
    .clamp(0, 1);
}
```

---

#### 模块 05 — 风险指数合成（组员 C）

```javascript
// ============================================================
// 05_risk_index.js
// 功能：加权合成各因子生成 WRI
// 负责人：组员 C
// ============================================================

/**
 * 计算综合野火风险指数（WRI）
 * @param {Object} factors - 包含所有归一化因子图像的对象
 * @param {Object} weights - 各因子权重（总和为 1）
 * @returns {ee.Image} WRI 图像（0-1）
 */
function calcWRI(factors, weights) {
  // 确保权重总和为 1
  var totalWeight = Object.values(weights).reduce(function(a, b) { return a + b; }, 0);

  var wri = ee.Image(0);

  // 遍历各因子，加权叠加
  wri = wri.add(factors.ndviDryness.multiply(weights.ndvi / totalWeight));
  wri = wri.add(factors.lstAnomaly.multiply(weights.lst / totalWeight));
  wri = wri.add(factors.precipDeficit.multiply(weights.precip / totalWeight));
  wri = wri.add(factors.windSpeed.multiply(weights.wind / totalWeight));
  wri = wri.add(factors.slope.multiply(weights.slope / totalWeight));
  wri = wri.add(factors.fireDensity.multiply(weights.fire / totalWeight));

  return wri.rename('WRI').clamp(0, 1);
}

// 默认权重（等权重）
var defaultWeights = {
  ndvi: 1,
  lst: 1,
  precip: 1,
  wind: 1,
  slope: 1,
  fire: 1
};
```

---

#### 模块 09 — UI 控制面板（组员 F）

```javascript
// ============================================================
// 09_ui_panels.js
// 功能：构建应用左侧控制面板
// 负责人：组员 F
// ============================================================

// --- 标题面板 ---
var titlePanel = ui.Panel({
  style: {padding: '8px', backgroundColor: '#1a1a2e'}
});
titlePanel.add(ui.Label('🔥 Wildfire Risk Index', {
  fontSize: '18px', fontWeight: 'bold', color: 'white'
}));
titlePanel.add(ui.Label('Global Fire Risk Prediction', {
  fontSize: '12px', color: '#aaaaaa'
}));

// --- 时间选择器 ---
var seasonSelect = ui.Select({
  items: [
    {label: 'Spring (Mar–May)', value: 'spring'},
    {label: 'Summer (Jun–Aug)', value: 'summer'},
    {label: 'Autumn (Sep–Nov)', value: 'autumn'},
    {label: 'Winter (Dec–Feb)', value: 'winter'}
  ],
  value: 'summer',
  style: {width: '200px'}
});

var yearSlider = ui.Slider({
  min: 2010, max: 2024, value: 2023, step: 1,
  style: {width: '200px'}
});

// --- 因子权重滑块 ---
function makeWeightSlider(label, defaultVal) {
  return ui.Panel([
    ui.Label(label, {fontSize: '11px'}),
    ui.Slider({min: 0, max: 5, value: defaultVal, step: 0.5, style: {width: '180px'}})
  ], ui.Panel.Layout.flow('vertical'));
}

var weightNDVI   = makeWeightSlider('🌿 Vegetation Dryness', 1);
var weightLST    = makeWeightSlider('🌡️ Land Surface Temp', 1);
var weightPrecip = makeWeightSlider('🌧️ Precipitation Deficit', 1);
var weightWind   = makeWeightSlider('💨 Wind Speed', 1);
var weightSlope  = makeWeightSlider('⛰️ Terrain Slope', 1);
var weightFire   = makeWeightSlider('🔥 Historical Fire', 1);

// --- 运行按钮 ---
var runButton = ui.Button({
  label: '▶  Run Analysis',
  style: {
    backgroundColor: '#e74c3c',
    color: 'white',
    fontWeight: 'bold',
    width: '200px',
    padding: '8px'
  },
  onClick: function() {
    runAnalysis();  // 触发分析函数（在 main.js 中定义）
  }
});

// --- 组装控制面板 ---
var controlPanel = ui.Panel({
  widgets: [
    titlePanel,
    ui.Label('📅 Time Period', {fontWeight: 'bold', margin: '8px 0 4px 0'}),
    ui.Label('Season:'), seasonSelect,
    ui.Label('Year:'), yearSlider,
    ui.Label('⚖️ Factor Weights', {fontWeight: 'bold', margin: '8px 0 4px 0'}),
    weightNDVI, weightLST, weightPrecip,
    weightWind, weightSlope, weightFire,
    runButton
  ],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '230px', padding: '8px', backgroundColor: '#f8f8f8'}
});
```

---

#### 模块 main.js — 主程序（全员集成）

```javascript
// ============================================================
// main.js
// 功能：整合所有模块，组装完整应用
// ============================================================

// 初始化地图
Map.setCenter(0, 20, 3);
Map.setOptions('HYBRID');
Map.setControlVisibility({all: false});

// 引入各模块（在 GEE 中通过 require 或直接粘贴）
// var dataImport   = require('users/yourname/CASA0025:preprocessing/01_data_import');
// var cloudMask    = require('users/yourname/CASA0025:preprocessing/02_cloud_masking');
// ... （或直接将各模块代码粘贴至此）

// 绑定控制面板到地图左侧
ui.root.clear();
ui.root.add(controlPanel);
ui.root.add(Map);

// 主分析函数（由 Run 按钮触发）
function runAnalysis() {
  // 1. 获取用户参数
  var season = seasonSelect.getValue();
  var year = yearSlider.getValue();
  var aoi = drawingTools.layers().get(0).getEeObject();

  // 2. 根据季节确定日期范围
  var dateRanges = {
    spring: [year + '-03-01', year + '-05-31'],
    summer: [year + '-06-01', year + '-08-31'],
    autumn: [year + '-09-01', year + '-11-30'],
    winter: [year + '-12-01', (year+1) + '-02-28']
  };
  var startDate = dateRanges[season][0];
  var endDate   = dateRanges[season][1];

  // 3. 加载数据
  var data = importDatasets(aoi, startDate, endDate);

  // 4. 预处理
  // ...

  // 5. 计算 WRI
  var weights = {
    ndvi: weightNDVI.widgets().get(1).getValue(),
    lst: weightLST.widgets().get(1).getValue(),
    precip: weightPrecip.widgets().get(1).getValue(),
    wind: weightWind.widgets().get(1).getValue(),
    slope: weightSlope.widgets().get(1).getValue(),
    fire: weightFire.widgets().get(1).getValue()
  };
  var wri = calcWRI(factors, weights);

  // 6. 显示结果
  Map.layers().reset();
  Map.addLayer(wri, {
    min: 0, max: 1,
    palette: ['#00cc00', '#ffff00', '#ff8800', '#ff0000']
  }, 'Wildfire Risk Index');
}
```

---

## 4. 如何发布为 GEE App 并嵌入 HTML

### 4.1 在 GEE Code Editor 发布 App

1. 在 Code Editor 中打开 `main.js`，确保应用可以正常运行
2. 点击顶部菜单 **"Apps"** → **"NEW APP"**
3. 填写信息：
   - App name：`wildfire-risk` （将成为 URL 的一部分）
   - Source code：选择你的 `main.js` 脚本
   - Sharing：选 **"Anyone can view"**（公开访问）
4. 点击 **"PUBLISH"**
5. 等待约 1 分钟，生成 App 链接：
   ```
   https://你的GEE用户名.users.earthengine.app/view/wildfire-risk
   ```

---

### 4.2 创建 HTML 展示页（index.html）

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Global Wildfire Risk Prediction System</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f0f1a; color: #eee; }

    /* 导航栏 */
    nav {
      background: #1a1a2e;
      padding: 16px 40px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #e74c3c;
    }
    nav h1 { font-size: 20px; color: white; }
    nav .badge {
      background: #e74c3c;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    /* GEE App 嵌入区域 */
    .app-container {
      width: 100%;
      height: calc(100vh - 60px);
    }
    .app-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* 项目信息区（可选，放在页面下方） */
    .info-section {
      padding: 60px 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .info-section h2 { color: #e74c3c; margin-bottom: 16px; }
    .info-section p { line-height: 1.8; color: #ccc; margin-bottom: 12px; }

    /* 数据来源卡片 */
    .data-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 24px;
    }
    .card {
      background: #1a1a2e;
      border-radius: 8px;
      padding: 16px;
      border-left: 3px solid #e74c3c;
    }
    .card h4 { color: white; margin-bottom: 8px; font-size: 14px; }
    .card p { color: #aaa; font-size: 12px; }

    footer {
      text-align: center;
      padding: 24px;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #333;
    }
  </style>
</head>
<body>

  <!-- 导航栏 -->
  <nav>
    <span style="font-size:24px">🔥</span>
    <h1>Global Wildfire Risk Prediction System</h1>
    <span class="badge">CASA0025</span>
  </nav>

  <!-- 嵌入 GEE App -->
  <div class="app-container">
    <iframe
      src="https://你的GEE用户名.users.earthengine.app/view/wildfire-risk"
      allowfullscreen>
    </iframe>
  </div>

  <!-- 项目说明 -->
  <div class="info-section">
    <h2>About This Application</h2>
    <p>
      This interactive application uses Google Earth Engine to assess wildfire risk globally.
      Users can draw a region of interest, select a time window, and adjust factor weights
      to generate a Wildfire Risk Index (WRI) map in real time.
    </p>
    <p>
      The WRI is a weighted composite of six satellite-derived environmental factors:
      vegetation dryness (NDVI), land surface temperature anomaly, precipitation deficit,
      wind speed, terrain slope, and historical fire density.
    </p>

    <h2 style="margin-top: 40px">Data Sources</h2>
    <div class="data-cards">
      <div class="card">
        <h4>🌿 MODIS NDVI</h4>
        <p>Vegetation dryness index at 250m resolution, updated every 16 days</p>
      </div>
      <div class="card">
        <h4>🌡️ MODIS LST</h4>
        <p>Daily land surface temperature at 1km resolution</p>
      </div>
      <div class="card">
        <h4>🌧️ CHIRPS</h4>
        <p>Daily precipitation data at 5.5km resolution from 1981 to present</p>
      </div>
      <div class="card">
        <h4>💨 ERA5-Land</h4>
        <p>Daily wind speed reanalysis data at ~11km resolution</p>
      </div>
      <div class="card">
        <h4>⛰️ SRTM</h4>
        <p>Global terrain slope at 30m resolution</p>
      </div>
      <div class="card">
        <h4>🔥 FIRMS</h4>
        <p>Historical MODIS fire detections from 2000 to present</p>
      </div>
    </div>

    <h2 style="margin-top: 40px">Team</h2>
    <p>UCL CASA0025 Group Project — [组员姓名列表]</p>
    <p>
      Source code:
      <a href="https://github.com/你的用户名/CASA0025-Wildfire-Risk"
         style="color: #e74c3c">
        GitHub Repository
      </a>
    </p>
  </div>

  <footer>
    <p>Built with Google Earth Engine · CASA0025 UCL · 2026</p>
  </footer>

</body>
</html>
```

---

## 5. 如何用 GitHub Pages 部署展示页

### 5.1 将 index.html 推送到 GitHub

```bash
# 确保 index.html 在仓库根目录 app/ 文件夹内
git add app/index.html
git commit -m "feat: create HTML landing page with embedded GEE app"
git push origin main
```

### 5.2 启用 GitHub Pages

1. 进入 GitHub 仓库页面
2. 点击 **Settings** → 左侧菜单 **"Pages"**
3. Source 选择：
   - Branch：`main`
   - Folder：`/app`（或 `/ (root)` 如果 index.html 在根目录）
4. 点击 **"Save"**
5. 等待约 1 分钟，页面自动部署

部署完成后会显示：
```
Your site is live at:
https://你的GitHub用户名.github.io/CASA0025-Wildfire-Risk/
```

### 5.3 更新展示页

每次修改 `index.html` 并推送到 main 分支后，GitHub Pages 会**自动重新部署**，无需手动操作。

---

## ✅ 整体检查清单

### Week 1 必须完成
- [ ] 所有组员 GEE 账号审批通过
- [ ] Cloud Project 创建，所有组员加入
- [ ] GitHub 仓库创建，所有组员接受邀请
- [ ] 分支结构建立（main / preprocessing / analysis / visualisation）
- [ ] 运行数据集验证代码，截图确认 6 个数据集全部可访问
- [ ] README 和 CONTRIBUTIONS 推送到仓库

### Week 2 必须完成
- [ ] `01_data_import.js` 完成并测试
- [ ] `02_cloud_masking.js` 完成并测试
- [ ] `03_anomaly_calculation.js` 完成并测试
- [ ] `04_normalisation.js` 完成并测试
- [ ] `05_risk_index.js` 初版完成，WRI 图层可生成
- [ ] `06_classification.js` 完成

### Week 3 必须完成
- [ ] `07_zonal_stats.js` 完成
- [ ] `08_map_layers.js` 完成
- [ ] `09_ui_panels.js` 完成
- [ ] `10_charts.js` 完成
- [ ] `11_inspector.js` 完成
- [ ] `main.js` 集成所有模块，端到端可运行

### Week 4 必须完成
- [ ] GEE App 发布，获得公开链接
- [ ] `index.html` 完成，嵌入 GEE App
- [ ] GitHub Pages 部署，获得展示页链接
- [ ] README 更新（加入两个链接）
- [ ] 所有代码注释覆盖完整
- [ ] Presentation PPT 完成并排练

---

*CASA0025 Group Project — UCL Centre for Advanced Spatial Analysis*
