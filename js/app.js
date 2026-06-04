/**
 * app.js — 知识图谱分层可视化主应用 v4.1
 * 
 * v4.1 分片加载：只加载摘要(2KB) → 点击行业再加载分片数据
 */
(function() {
  'use strict';

  // ── 全局状态 ──
  let summaryData = null;
  let fullData = null;           // 完整数据（后台懒加载）
  let currentLevel = 1;
  let currentIndustryData = null; // 当前加载的行业分片数据
  let breadcrumbPath = [];

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

  // ── 工具 ──
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
  // 安全文件名（与导出脚本一致）
  function safeIndustryName(name) {
    return name.replace(/\//g, '_').replace(/\\/g, '_').replace(/ /g, '_');
  }

  // ── 数据加载 ──
  async function loadSummary() {
    showLoading('加载数据摘要...');
    const resp = await fetch('data/kg_summary.json');
    if (!resp.ok) throw new Error('摘要加载失败');
    return resp.json();
  }

  // 后台懒加载完整数据（用于搜索等需要全局数据的场景）
  async function loadFullInBackground() {
    try {
      const resp = await fetch('data/kg_data.json');
      if (resp.ok) {
        fullData = await resp.json();
        console.log('✅ 完整数据后台加载完成:', fullData.meta);
      }
    } catch(e) {
      console.warn('完整数据后台加载失败:', e);
    }
  }

  // 按需加载行业分片
  async function loadIndustryData(indName) {
    const safeName = safeIndustryName(indName);
    const resp = await fetch(`data/industries/${safeName}.json`);
    if (!resp.ok) throw new Error(`行业数据加载失败: ${indName} (${resp.status})`);
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
    const totalEnt = data.meta.total_entities || 0;
    const totalRel = data.meta.total_relations || 0;
    const totalInd = data.industries.length || 0;
    const totalFw = data.meta.total_frameworks || 0;
    const totalLc = data.meta.total_logic_chains || 0;
    const totalIndicators = data.meta.total_indicators || 0;
    els.statsSummary.innerHTML = `
      <div class="attr-row"><span class="attr-key">📦 实体</span><span class="attr-val">${totalEnt}</span></div>
      <div class="attr-row"><span class="attr-key">🔗 关系</span><span class="attr-val">${totalRel}</span></div>
      <div class="attr-row"><span class="attr-key">🏭 行业</span><span class="attr-val">${totalInd}</span></div>
      <div class="attr-row"><span class="attr-key">📐 框架</span><span class="attr-val" style="color:#F39C12">${totalFw}</span></div>
      <div class="attr-row"><span class="attr-key">🧠 逻辑链</span><span class="attr-val" style="color:#9B59B6">${totalLc}</span></div>
      <div class="attr-row"><span class="attr-key">📊 指标</span><span class="attr-val" style="color:#2ECC71">${totalIndicators}</span></div>
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

  // ── 导航 ──
  async function navigateTo(level, name) {
    breadcrumbPath = breadcrumbPath.slice(0, level - 1);

    if (level === 1) {
      Level1Circular.init('viz-canvas', summaryData, fullData);
      currentLevel = 1;
      currentIndustryData = null;
      setLevelBadge(1, 'Level 1 · 行业全景');
      breadcrumbPath.push({ level: 1, name: '行业全景', type: 'root' });
      setStatus('Level 1 · 行业全景', `${summaryData.industries.length} 个行业 | ${summaryData.meta.total_entities} 实体`);
      Level3Detail.hide();
      renderIndustryNav(summaryData);
      updateBreadcrumb();

    } else if (level === 2) {
      showLoading(`加载 ${name} ...`);
      try {
        // 按需加载行业分片数据
        const indData = await loadIndustryData(name);
        currentIndustryData = indData;
        window._currentIndustryData = indData;

        // 为 Level 3 详情面板设置行业数据
        Level3Detail.setIndustryData(indData);

        // 构建 fakeFullData 供 Level2Progressive 兼容使用
        const fakeFullData = {
          logic_entity_edges: indData.logic_entity_edges || [],
          indicator_entity_edges: indData.indicator_entity_edges || [],
        };

        await Level2Progressive.loadIndustry(name, fakeFullData, 'viz-canvas', (msg) => {
          els.loadingText.textContent = msg;
        });

        hideLoading();
        currentLevel = 2;
        setLevelBadge(2, `Level 2 · ${name}`);
        if (breadcrumbPath.length === 0) {
          breadcrumbPath.push({ level: 1, name: '行业全景', type: 'root' });
        }
        breadcrumbPath.push({ level: 2, name: name, type: 'industry' });
        const c = indData.counts || {};
        setStatus(`Level 2 · ${name}`,
          `${c.entity_count || 0} 实体 · ${c.relation_count || 0} 关系 · ${c.framework_count || 0} 框架 · ${c.logic_count || 0} 逻辑 · ${c.indicator_count || 0} 指标`);
        Level3Detail.hide();
        updateBreadcrumb();
        document.querySelectorAll('.industry-nav-item').forEach(item => {
          item.classList.toggle('active', item.dataset.industry === name);
        });
      } catch(err) {
        hideLoading();
        console.error('行业数据加载失败:', err);
        setStatus('错误', err.message);
        alert('行业数据加载失败: ' + err.message);
      }

    } else if (level === 3) {
      updateBreadcrumb();
    }
  }

  function navigateBack() {
    if (currentLevel > 1) {
      navigateTo(currentLevel - 1, breadcrumbPath[breadcrumbPath.length - 2]?.name || '行业全景');
    }
  }

  // ── 全局事件 ──
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
      navigateTo(2, breadcrumbPath[breadcrumbPath.length - 1]?.name);
    }
  };
  window.onHighlightEntity = function(entityId, relType) {
    Level2Progressive.highlightEntity(entityId);
    document.querySelectorAll('.relation-item').forEach(item => {
      if (item.dataset.entityId === entityId && item.dataset.relType === relType) {
        item.style.background = 'rgba(29,155,240,0.3)';
      } else {
        item.style.background = '';
      }
    });
  };

  function toggleRelFilter(type, active) {
    console.log('Toggle relation filter:', type, active);
  }

  // ── 按钮 ──
  els.btnReset.onclick = () => navigateTo(1, null);
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
      summaryData = await loadSummary();
      fullData = null; // 暂时不用完整数据

      Level3Detail.setData(null); // 初始无数据，Level3按需传入

      renderIndustryNav(summaryData);
      renderStats(summaryData);
      renderTypeLegend(summaryData);
      renderRelFilters(summaryData);

      Level1Circular.init('viz-canvas', summaryData, null);

      currentLevel = 1;
      setLevelBadge(1, 'Level 1 · 行业全景');
      breadcrumbPath = [{ level: 1, name: '行业全景', type: 'root' }];
      setStatus('就绪', `${summaryData.industries.length} 行业 | ${summaryData.meta.total_entities} 实体`);
      updateBreadcrumb();
      hideLoading();

      // 后台懒加载完整数据（不阻塞首次渲染）
      loadFullInBackground();

      console.log('✅ 知识图谱 v4.1 分片加载已就绪');
    } catch (err) {
      hideLoading();
      console.error('❌ 初始化失败:', err);
      setStatus('错误', err.message);
      els.breadcrumb.style.display = 'none';
    }
  }

  init();
})();