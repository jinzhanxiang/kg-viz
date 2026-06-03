/**
 * level3-detail.js — Level 3: 实体详情面板
 * 
 * 显示选中实体的完整信息：
 * - 基本信息（名称、类型、行业、股票等）
 * - 描述和核心属性
 * - 相关关系列表
 * - Wiki 页面链接
 */

const Level3Detail = (function() {
  let currentEntity = null;
  let fullData = null;

  const TYPE_LABELS = {
    ORG: '组织机构', PERSON: '人物', PRODUCT: '产品',
    TECH: '技术', INDUSTRY: '行业领域', POLICY: '政策法规',
    PLACE: '地点', UNKNOWN: '未知',
  };

  const REL_LABELS = {
    '上下游': '上下游关系', '供应': '供应关系', '合作': '合作关系',
    '竞争': '竞争关系', '监管': '监管关系', '客户': '客户关系',
    '投资': '投资关系', '战略联盟': '战略联盟', '对比': '对比关系',
    '股东': '股东关系', '子公司': '子公司', '收购': '收购关系',
    '技术链': '技术链', '供应商': '供应商', '市场化': '市场化',
    '母公司': '母公司', '关联': '关联', '同现': '同现',
  };

  function getRelLabel(type) {
    return REL_LABELS[type] || type;
  }

  function getTypeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS[type.toUpperCase()] || type;
  }

  // 显示实体详情
  function showDetail(entity, containerId, onData) {
    currentEntity = entity;
    const bodyEl = document.getElementById(containerId);
    if (!bodyEl) return;

    const typeLabel = getTypeLabel(entity.type);
    const typeColor = getEntityColor(entity.type);

    let html = '';

    // ── 基本信息卡片 ──
    html += `<div class="detail-card">
      <h5>基本信息</h5>`;

    html += `<div class="attr-row">
        <span class="attr-key">名称</span>
        <span class="attr-val">${escapeHtml(entity.name)}</span>
      </div>`;

    html += `<div class="attr-row">
        <span class="attr-key">类型</span>
        <span class="attr-val" style="color:${typeColor}">${typeLabel}</span>
      </div>`;

    if (entity.industry) {
      html += `<div class="attr-row">
        <span class="attr-key">行业</span>
        <span class="attr-val">${escapeHtml(entity.industry)}</span>
      </div>`;
    }

    if (entity.stock) {
      html += `<div class="attr-row">
        <span class="attr-key">股票代码</span>
        <span class="attr-val">${escapeHtml(entity.stock)}</span>
      </div>`;
    }

    if (entity.is_core) {
      html += `<div class="attr-row">
        <span class="attr-key">核心实体</span>
        <span class="attr-val" style="color:#00ba7c;font-weight:bold;">★ 是</span>
      </div>`;
    }

    html += `</div>`;

    // ── 描述卡片 ──
    if (entity.desc) {
      html += `<div class="detail-card">
        <h5>描述</h5>
        <p>${escapeHtml(entity.desc)}</p>
      </div>`;
    }

    // ── 核心属性卡片 ──
    if (entity.attrs) {
      html += `<div class="detail-card">
        <h5>核心属性</h5>
        <p>${escapeHtml(entity.attrs)}</p>
      </div>`;
    }

    // ── 相关关系卡片 ──
    if (fullData && fullData.all_relations) {
      const entityRelations = fullData.all_relations.filter(r =>
        r.from === entity.id || r.to === entity.id
      );

      if (entityRelations.length > 0) {
        // 按关系类型分组
        const byType = {};
        entityRelations.forEach(r => {
          const key = r.type;
          if (!byType[key]) byType[key] = [];
          byType[key].push(r);
        });

        html += `<div class="detail-card">
          <h5>相关关系 (${entityRelations.length})</h5>
          <div class="relation-list">`;

        Object.entries(byType).forEach(([relType, rels]) => {
          const label = getRelLabel(relType);
          const color = getRelationColor(relType);

          html += `<div style="margin-bottom:6px;">
            <div style="font-size:11px;color:#71767b;margin-bottom:2px;">${label} (${rels.length})</div>`;

          // 最多显示5个
          rels.slice(0, 5).forEach(r => {
            const target = r.from === entity.id ? r.to_name : r.from_name;
            const targetId = r.from === entity.id ? r.to : r.from;
            html += `<div class="relation-item" data-entity-id="${targetId}" data-rel-type="${relType}">
              <span class="rel-type" style="background:${color}">${relType}</span>
              <span class="rel-target">${escapeHtml(target)}</span>
            </div>`;
          });

          if (rels.length > 5) {
            html += `<div style="font-size:11px;color:#71767b;padding:4px 8px;">
              … 还有 ${rels.length - 5} 个
            </div>`;
          }

          html += `</div>`;
        });

        html += `  </div></div>`;
      }
    }

    // ── Wiki 链接卡片 ──
    html += `<div class="detail-card">
      <h5>知识库</h5>
      <p style="color:#1d9bf0;cursor:pointer;" id="wiki-link">📄 查看 Wiki 页面</p>
    </div>`;

    bodyEl.innerHTML = html;

    // 更新标题
    const titleEl = document.getElementById('detail-title');
    if (titleEl) {
      titleEl.textContent = `${entity.name} · ${typeLabel}`;
      titleEl.style.color = typeColor;
    }

    // 移除隐藏类
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.remove('hidden');

    // Wiki 链接点击
    const wikiLink = document.getElementById('wiki-link');
    if (wikiLink) {
      wikiLink.onclick = function() {
        const wikiPath = `entities/${safeFilename(entity.name)}.md`;
        const wikiUrl = `../wiki-viewer.html?path=${encodeURIComponent(wikiPath)}`;
        window.open(wikiUrl, '_blank');
      };
    }

    // 关系项点击 → 高亮
    document.querySelectorAll('.relation-item').forEach(item => {
      item.onclick = function() {
        const targetId = this.dataset.entityId;
        const relType = this.dataset.relType;
        if (window.onHighlightEntity) {
          window.onHighlightEntity(targetId, relType);
        }
      };
    });

    if (onData) onData(entity);
  }

  // 安全转义
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 安全文件名
  function safeFilename(name) {
    return name.replace(/[\s\n]+/g, '_').slice(0, 50);
  }

  // 实体类型颜色
  const TYPE_COLORS = {
    ORG: '#4A90D9', PERSON: '#50C878', PRODUCT: '#FFB347',
    TECH: '#FF6B6B', INDUSTRY: '#FFD700', POLICY: '#FF8C42',
    PLACE: '#48C9B0', UNKNOWN: '#95A5A6',
  };
  function getEntityColor(type) {
    return TYPE_COLORS[type] || TYPE_COLORS[type.toUpperCase()] || '#95A5A6';
  }

  // 关系类型颜色
  const REL_PALETTE = [
    '#E74C3C', '#F39C12', '#2ECC71', '#3498DB', '#9B59B6',
    '#1ABC9C', '#E67E22', '#E91E63', '#00BCD4', '#FF9800',
  ];
  function getRelationColor(type) {
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    return REL_PALETTE[Math.abs(hash) % REL_PALETTE.length];
  }

  // 隐藏详情面板
  function hide() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.add('hidden');
    currentEntity = null;
  }

  // 关闭详情
  function close() {
    hide();
    currentEntity = null;
  }

  // 设置数据源
  function setData(data) {
    fullData = data;
  }

  function getCurrentEntity() { return currentEntity; }

  return {
    showDetail,
    hide,
    close,
    setData,
    getCurrentEntity,
  };
})();
