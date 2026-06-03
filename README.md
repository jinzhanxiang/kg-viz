# 🗺️ 知识图谱分层可视化系统 v3

知识图谱的三级交互式可视化探索系统。

## 三级探索体系

```
Level 1 — 环形行业全景图
  ↓ 点击行业节点
Level 2 — 行业内部渐进式加载
  ↓ 点击实体
Level 3 — 实体详情面板 + Wiki 链接
```

- **Level 1**: 9 大行业环形排列，节点大小按实体数比例，跨行业关系用虚线连接
- **Level 2**: 渐进式 3 阶段加载（核心实体 → 全部实体 → 关系网络）
- **Level 3**: 实体基本信息、描述、核心属性、相关关系列表、Wiki 页面链接

## 技术栈

- [vis-network.js](https://visjs.github.io/vis-network/) — 网络图引擎
- 纯前端静态页面，无后端依赖

## 本地预览

```bash
cd visualization
python3 -m http.server 8080
# 访问 http://localhost:8080
```

## 数据更新

当知识图谱数据库有新数据时：

```bash
cd scripts/cleaning
python3 r63_v3_kg_export.py
```

## 文件结构

```
visualization/
├── index.html         — 主入口（三栏布局）
├── css/style.css      — 深色主题样式
├── js/
│   ├── app.js              — 主应用编排器
│   ├── level1-circular.js  — Level 1: 环形行业全景
│   ├── level2-progressive.js — Level 2: 渐进加载
│   └── level3-detail.js    — Level 3: 实体详情
└── data/
    ├── kg_data.json     — 完整导出数据 (~6MB)
    └── kg_summary.json  — 摘要数据
```

## 数据概况

| 指标 | 数量 |
|------|------|
| 实体 | 3,055 |
| 关系 | 6,297 |
| 行业 | 9 |
| 实体类型 | 7 种 |
| 关系类型 | 15 种 |
