/**
 * app.js — 知识图谱分层可视化主应用
 * 
 * 协调 Level 1 → Level 2 → Level 3 三级探索流程。
 * 负责数据加载、导航更新、面包屑管理、全局事件绑定。
 */

(function() {
  'use strict';

  // ── 全局状态 ──
  let summaryData = null;
  let fullData = null;
  let currentLevel = 1;
  let breadcrumbPath = [];  // [{level, name, type}]

  // ── DOM 元素 ──
  const els = {
    levelBadge: document.getElementById('level-badge'),
    industryList: document.getElementById('industry-list'),
    statsSummary: document.getElementById('stats-summary'),
    typeLegend: document.getElementById('type-legend'),
    relFilters: document.getElementById('rel-filters'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    statusBarLeft: document.getElementById('status-left'),
    statusBarRight: document.getElementById('status-right'),
    breadcrumb: document.getElementById('breadcrumb'),
    btnReset: document.getElementById('btn-reset'),
    btnFit: document.getElementById('btn-fit'),
    btnExport: document.getElementById('btn-export'),
    btnCloseDetail: document.getElementById('btn-close-detail'),
  };

  // ── 工具函数 ──
  function showLoading(msg) {
    els.loadingText.textContent = msg;
    els.loading.classList.add('visible');
  }
  function hideLoading() {
    els.loading.classList.remove('visible');
  }
  function setStatus(left, right) {
    els.statusBarLeft.textContent = left;
    els.statusBarRight.textContent = right;
  }
  function setLevelBadge(level, label) {
    els.levelBadge.textContent = label;
  }
  function updateBreadcrumb() {
    if (breadcrumbPath.length === 0) {
      els.breadcrumb.style.display = 'none';
      return;
    }
    els.breadcrumb.style.display = 'flex';
    els.breadcrumb.innerHTML = breadcrumbPath.map((item, i) => {
      const sep = i > 0 ? `<span class="breadcrumb-sep">›</span>` : '';
      const clickable = i < breadcrumbPath.length - 1;
      return `${sep}${clickable
        ? `<span class="breadcrumb-item" data-lvl="${item.level}" data-name="${escapeAttr(item.name)}">${escapeHtml(item.name)}</span>`
        : `<span class="breadcrumb-item" style="color:#e7e9ea">${escapeHtml(item.name)}</span>`
      }`;
    }).join('');

    // 面包屑点击导航
    document.querySelectorAll('.breadcrumb-item').forEach(item => {
      item.onclick = function() {
        const lvl = parseInt(this.dataset.lvl);
        const name = this.dataset.name;
        navigateTo(lvl, name);
      };
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  // ── 数据加载 ──
  async function loadSummary() {
    showLoading('加载数据摘要...');
    const resp = await fetch('data/kg_summary.json');
    if (!resp.ok) throw new Error('摘要加载失败');
    return resp.json();
  }

  async function loadFullData() {
    showLoading('加载完整数据（请稍候）...');
    const resp = await fetch('data/kg_data.json');
    if (!resp.ok) throw new Error('完整数据加载失败');
    return resp.json();
  }

  // ── 导航渲染 ──
  function renderIndustryNav(data) {
    els.industryList.innerHTML = '';
    data.industries.forEach(ind => {
      const item = document.createElement('div');
      item.className = 'nav-item industry-nav-item';
      item.dataset.industry = ind.name;
      item.onclick = () => navigateTo(2, ind.name);

      const color = getIndustryColor(ind.count, data.industries[0].count);
      item.innerHTML = `
        <span class="nav-indicator" style="background:${color}"></span>
        <span class="nav-name">${escapeHtml(ind.name)}</span>
        <span class="nav-count">${ind.count}</span>
      `;
      els.industryList.appendChild(item);
    });
  }

  function renderStats(data) {
    const totalEnt = data.meta.total_entities;
    const totalRel = data.meta.total_relations;
    const totalInd = data.industries.length;

    els.statsSummary.innerHTML = `
      <div class="attr-row"><span class="attr-key">实体</span><span class="attr-val">${totalEnt}</span></div>
      <div class="attr-row"><span class="attr-key">关系</span><span class="attr-val">${totalRel}</span></div>
      <div class="attr-row"><span class="attr-key">行业</span><span class="attr-val">${totalInd}</span></div>
    `;
  }

  function renderTypeLegend(data) {
    els.typeLegend.innerHTML = '';
    data.entity_types.forEach(t => {
      const item = document.createElement('div');
      item.className = 'type-legend-item';
      item.innerHTML = `
        <span class="type-legend-dot" style="background:${t.color}"></span>
        <span>${getTypeLabel(t.type)}</span>
      `;
      els.typeLegend.appendChild(item);
    });
  }

  function renderRelFilters(data) {
    els.relFilters.innerHTML = '';
    data.relation_types.forEach(rt => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip active';
      chip.dataset.type = rt.type;
      chip.innerHTML = `<span class="fc-dot" style="background:${rt.color}"></span>${rt.type} (${rt.count})`;
      chip.onclick = () => {
        chip.classList.toggle('active');
        toggleRelFilter(rt.type, chip.classList.contains('active'));
      };
      els.relFilters.appendChild(chip);
    });
  }

  function getIndustryColor(count, maxCount) {
    const intensity = Math.min(count / maxCount, 1);
    const r = Math.round(29 + intensity * 168);
    const g = Math.round(155 + intensity * 41);
    return `rgb(${r},${g},240)`;
  }

  function getTypeLabel(type) {
    const map = {
      ORG: '组织', PERSON: '人物', PRODUCT: '产品',
      TECH: '技术', INDUSTRY: '行业', POLICY: '政策',
      PLACE: '地点', UNKNOWN: '未知',
      framework: '框架', indicator: '指标', logic: '逻辑链',
    };
    return map[type] || map[type.toUpperCase()] || type;
  }

  // ── 导航逻辑 ──
  function navigateTo(level, name) {
    breadcrumbPath = breadcrumbPath.slice(0, level - 1);

    if (level === 1) {
      // 回到 Level 1
      Level1Circular.init('viz-canvas', summaryData, fullData);
      currentLevel = 1;
      setLevelBadge(1, 'Level 1 · 行业全景');
      breadcrumbPath.push({ level: 1, name: '行业全景', type: 'root' });
      setStatus('Level 1 · 行业全景', `${summaryData.industries.length} 个行业 | ${summaryData.meta.total_entities} 实体`);
      Level3Detail.hide();
      renderIndustryNav(summaryData);
      updateBreadcrumb();
    } else if (level === 2) {
      // 进入 Level 2
      showLoading(`加载 ${name} ...`);
      setTimeout(() => {
        Level2Progressive.loadIndustry(name, fullData, 'viz-canvas', (msg) => {
          els.loadingText.textContent = msg;
        }).then(() => {
          hideLoading();
          currentLevel = 2;
          setLevelBadge(2, `Level 2 · ${name}`);
          if (breadcrumbPath.length === 0) {
            breadcrumbPath.push({ level: 1, name: '行业全景', type: 'root' });
          }
          breadcrumbPath.push({ level: 2, name: name, type: 'industry' });
          setStatus(`Level 2 · ${name}`, `${fullData.industries_map[name]?.entity_count || 0} 实体 | ${fullData.industries_map[name]?.relation_count || 0} 关系`);
          Level3Detail.hide();
          updateBreadcrumb();

          // 高亮导航栏
          document.querySelectorAll('.industry-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.industry === name);
          });
        });
      }, 100);
    } else if (level === 3) {
      // Level 3 在详情面板中，不改变主视图
      updateBreadcrumb();
    }
  }

  function navigateBack() {
    if (currentLevel > 1) {
      navigateTo(currentLevel - 1, breadcrumbPath[breadcrumbPath.length - 2]?.name || '行业全景');
    }
  }

  // ── 全局事件回调 ──
  window.onEnterLevel2 = function(industryName, count) {
    navigateTo(2, industryName);
  };

  window.onEnterLevel3 = function(entity) {
    Level3Detail.showDetail(entity, 'detail-body', () => {
      breadcrumbPath.push({ level: 3, name: entity.name, type: 'entity' });
      updateBreadcrumb();
    });
  };

  window.onToggleIsolatedNodes = function() {
    window._showIsolatedNodes = document.getElementById('toggle-isolated').checked;
    if (currentLevel === 2 && breadcrumbPath.length >= 2) {
      const industryName = breadcrumbPath[breadcrumbPath.length - 1]?.name;
      if (industryName) {
        navigateTo(2, industryName);
      }
    }
  };

  window.onHighlightEntity = function(entityId, relType) {
    Level2Progressive.highlightEntity(entityId);
    // 在详情面板中高亮对应关系项
    document.querySelectorAll('.relation-item').forEach(item => {
      if (item.dataset.entityId === entityId && item.dataset.relType === relType) {
        item.style.background = 'rgba(29,155,240,0.3)';
      } else {
        item.style.background = '';
      }
    });
  };

  function toggleRelFilter(type, active) {
    // TODO: 实现关系类型筛选
    console.log('Toggle relation filter:', type, active);
  }

  // ── 按钮事件 ──
  els.btnReset.onclick = function() {
    navigateTo(1, null);
  };

  els.btnFit.onclick = function() {
    if (currentLevel === 1 && Level1Circular.getNetwork()) {
      Level1Circular.getNetwork().fit({ animation: { duration: 400 } });
    } else if (currentLevel === 2 && Level2Progressive.getNetwork()) {
      Level2Progressive.getNetwork().fit({ animation: { duration: 400 } });
    }
  };

  els.btnExport.onclick = function() {
    const canvas = document.querySelector('#viz-canvas canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `kg_viz_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  els.btnCloseDetail.onclick = function() {
    Level3Detail.close();
    Level2Progressive.clearHighlight();
  };

  // ── 初始化 ──
  async function init() {
    try {
      // 并行加载摘要和完整数据
      const [summary, full] = await Promise.all([loadSummary(), loadFullData()]);
      summaryData = summary;
      fullData = full;

      // 设置 Level 3 数据源
      Level3Detail.setData(fullData);

      // 渲染导航
      renderIndustryNav(summaryData);
      renderStats(summaryData);
      renderTypeLegend(summaryData);
      renderRelFilters(summaryData);

      // 初始化 Level 1
      Level1Circular.init('viz-canvas', summaryData, fullData);

      currentLevel = 1;
      setLevelBadge(1, 'Level 1 · 行业全景');
      breadcrumbPath = [{ level: 1, name: '行业全景', type: 'root' }];
      setStatus('就绪', `${summaryData.industries.length} 行业 | ${summaryData.meta.total_entities} 实体 | ${summaryData.meta.total_relations} 关系`);
      updateBreadcrumb();

      hideLoading();
      console.log('✅ 知识图谱 v3 分层可视化已就绪');
    } catch (err) {
      hideLoading();
      console.error('❌ 初始化失败:', err);
      setStatus('错误', err.message);
      els.breadcrumb.style.display = 'none';
    }
  }

  // 启动
  init();
})();
