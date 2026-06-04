/**
 * level3-detail.js — Level 3: 详情面板 v4
 * 
 * 支持所有节点类型：
 * - entity: 实体详情（基本信息、描述、属性、关系）
 * - framework: 框架详情（步骤、分类、置信度）
 * - logic: 逻辑链详情（前提、结论、文本）
 * - indicator: 指标详情（值、单位、类型）
 */
const Level3Detail = (function() {
  let currentEntity = null;
  let fullData = null;
  let industryData = null; // 当前行业数据分片

  const TYPE_LABELS = {
    ORG: '组织机构', PERSON: '人物', PRODUCT: '产品',
    TECH: '技术', INDUSTRY: '行业领域', POLICY: '政策法规',
    PLACE: '地点', UNKNOWN: '未知',
    framework: '研究框架', indicator: '指标', logic: '逻辑链', report: '报告',
  };

  const REL_LABELS = {
    '上下游': '上下游关系', '供应': '供应关系', '合作': '合作关系',
    '竞争': '竞争关系', '监管': '监管关系', '客户': '客户关系',
    '投资': '投资关系', '战略联盟': '战略联盟', '对比': '对比关系',
    '股东': '股东关系', '子公司': '子公司', '收购': '收购关系',
    '技术链': '技术链', '供应商': '供应商', '市场化': '市场化',
    '母公司': '母公司', '关联': '关联', '同现': '同现',
    '逻辑关联': '逻辑关联', '指标关联': '指标关联',
  };

  const TYPE_COLORS = {
    ORG: '#4A90D9', PERSON: '#50C878', PRODUCT: '#FFB347',
    TECH: '#FF6B6B', INDUSTRY: '#FFD700', POLICY: '#FF8C42',
    PLACE: '#48C9B0', UNKNOWN: '#95A5A6',
    framework: '#F39C12', indicator: '#2ECC71',
    logic: '#9B59B6', report: '#95A5A6',
  };

  function getRelLabel(type) {
    return REL_LABELS[type] || type;
  }

  function getTypeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS[type.toUpperCase()] || type;
  }

  function getEntityColor(type) {
    return TYPE_COLORS[type] || TYPE_COLORS[type.toUpperCase()] || '#95A5A6';
  }

  function showDetail(entity, containerId, onData) {
    currentEntity = entity;
    const bodyEl = document.getElementById(containerId);
    if (!bodyEl) return;

    const nodeType = entity.nodeType || 'entity';
    const typeLabel = getTypeLabel(entity.type);
    const typeColor = getEntityColor(entity.type);

    let html = '';

    if (nodeType === 'entity') {
      html = buildEntityDetail(entity, typeLabel, typeColor);
    } else if (nodeType === 'framework') {
      html = buildFrameworkDetail(entity, typeLabel, typeColor);
    } else if (nodeType === 'logic') {
      html = buildLogicDetail(entity, typeLabel, typeColor);
    } else if (nodeType === 'indicator') {
      html = buildIndicatorDetail(entity, typeLabel, typeColor);
    } else {
      html = buildEntityDetail(entity, typeLabel, typeColor);
    }

    // 如果是聚类节点，显示展开提示
    if (entity.isCluster) {
      html = `<div class="detail-card">
        <h5>聚类节点</h5>
        <p style="color:#71767b">双击展开此聚类查看详细内容</p>
      </div>`;
    }

    bodyEl.innerHTML = html;

    // 更新标题
    const titleEl = document.getElementById('detail-title');
    if (titleEl) {
      titleEl.textContent = `${entity.name || entity.label} · ${typeLabel}`;
      titleEl.style.color = typeColor;
    }

    // 显示面板
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.remove('hidden');

    // Wiki 链接点击
    const wikiLink = document.getElementById('wiki-link');
    if (wikiLink) {
      wikiLink.onclick = function() {
        const wikiPath = `entities/${safeFilename(entity.name || entity.label)}.md`;
        const wikiUrl = `../../../wiki/wiki-viewer.html?path=${encodeURIComponent(wikiPath)}`;
        window.open(wikiUrl, '_blank');
      };
    }

    // 关系项点击
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

  // 实体详情
  function buildEntityDetail(entity, typeLabel, typeColor) {
    let html = '';
    // 基本信息
    html += `<div class="detail-card"><h5>基本信息</h5>`;
    html += `<div class="attr-row"><span class="attr-key">名称</span><span class="attr-val">${escapeHtml(entity.name || entity.label)}</span></div>`;
    html += `<div class="attr-row"><span class="attr-key">类型</span><span class="attr-val" style="color:${typeColor}">${typeLabel}</span></div>`;
    if (entity.industry) {
      html += `<div class="attr-row"><span class="attr-key">行业</span><span class="attr-val">${escapeHtml(entity.industry)}</span></div>`;
    }
    if (entity.stock) {
      html += `<div class="attr-row"><span class="attr-key">股票代码</span><span class="attr-val">${escapeHtml(entity.stock)}</span></div>`;
    }
    if (entity.is_core) {
      html += `<div class="attr-row"><span class="attr-key">核心</span><span class="attr-val" style="color:#00ba7c;font-weight:bold;">★ 是</span></div>`;
    }
    html += `</div>`;

    // 描述
    if (entity.desc) {
      html += `<div class="detail-card"><h5>描述</h5><p>${escapeHtml(entity.desc)}</p></div>`;
    }
    // 属性
    if (entity.attrs) {
      html += `<div class="detail-card"><h5>核心属性</h5><p>${escapeHtml(entity.attrs)}</p></div>`;
    }
    // 关系
    html += buildRelationCard(entity);
    // Wiki
    html += `<div class="detail-card"><h5>知识库</h5><p style="color:#1d9bf0;cursor:pointer;" id="wiki-link">📄 查看 Wiki 页面</p></div>`;
    return html;
  }

  // 框架详情
  function buildFrameworkDetail(entity, typeLabel, typeColor) {
    let html = '';
    html += `<div class="detail-card"><h5>研究框架</h5>`;
    html += `<div class="attr-row"><span class="attr-key">名称</span><span class="attr-val">${escapeHtml(entity.name)}</span></div>`;
    html += `<div class="attr-row"><span class="attr-key">类型</span><span class="attr-val" style="color:${typeColor}">${typeLabel}</span></div>`;

    // 从 fullData 中查找框架详情
    const fw = findEntityInData(entity.id, 'frameworks');
    if (fw) {
      if (fw.category) {
        html += `<div class="attr-row"><span class="attr-key">分类</span><span class="attr-val">${escapeHtml(fw.category)}</span></div>`;
      }
      if (fw.confidence) {
        html += `<div class="attr-row"><span class="attr-key">置信度</span><span class="attr-val">${(fw.confidence * 100).toFixed(0)}%</span></div>`;
      }
      if (fw.industry) {
        html += `<div class="attr-row"><span class="attr-key">适用行业</span><span class="attr-val">${escapeHtml(fw.industry)}</span></div>`;
      }
    }
    html += `</div>`;

    // 内容
    if (fw && fw.content) {
      html += `<div class="detail-card"><h5>内容</h5><p style="font-size:12px;line-height:1.6">${escapeHtml(fw.content)}</p></div>`;
    }

    // 步骤
    if (fw && fw.steps) {
      let stepsHtml;
      try {
        const steps = JSON.parse(fw.steps);
        if (Array.isArray(steps)) {
          stepsHtml = steps.map((s, i) => `<li style="margin:6px 0;font-size:12px;line-height:1.5"><strong>步骤${i+1}</strong>: ${escapeHtml(s)}</li>`).join('');
        }
      } catch(e) {}
      if (stepsHtml) {
        html += `<div class="detail-card"><h5>分析步骤 (${fw.framework_type || ''})</h5><ol style="padding-left:20px;margin:8px 0">${stepsHtml}</ol></div>`;
      }
    }

    // 关联实体
    html += buildRelatedEntities(entity, 'framework_entity');
    return html;
  }

  // 逻辑链详情
  function buildLogicDetail(entity, typeLabel, typeColor) {
    let html = '';
    html += `<div class="detail-card"><h5>逻辑链</h5>`;
    html += `<div class="attr-row"><span class="attr-key">ID</span><span class="attr-val">${escapeHtml(entity.id)}</span></div>`;

    const lc = findEntityInData(entity.id, 'logic_chains');
    if (lc) {
      if (lc.type) {
        html += `<div class="attr-row"><span class="attr-key">类型</span><span class="attr-val" style="color:${typeColor}">${escapeHtml(lc.type)}</span></div>`;
      }
      if (lc.dimension) {
        html += `<div class="attr-row"><span class="attr-key">维度</span><span class="attr-val">${escapeHtml(lc.dimension)}</span></div>`;
      }
      if (lc.confidence) {
        html += `<div class="attr-row"><span class="attr-key">置信度</span><span class="attr-val">${(lc.confidence * 100).toFixed(0)}%</span></div>`;
      }
    }
    html += `</div>`;

    // 前提
    if (lc && lc.premise) {
      html += `<div class="detail-card"><h5>前提</h5><p style="font-size:12px;line-height:1.6">${escapeHtml(lc.premise)}</p></div>`;
    }
    // 结论
    if (lc && lc.conclusion) {
      html += `<div class="detail-card"><h5>结论</h5><p style="font-size:12px;line-height:1.6">${escapeHtml(lc.conclusion)}</p></div>`;
    }
    // 全文
    if (lc && lc.text) {
      html += `<div class="detail-card"><h5>逻辑描述</h5><p style="font-size:12px;line-height:1.6">${escapeHtml(lc.text)}</p></div>`;
    }

    // 关联实体
    html += buildRelatedEntities(entity, 'logic_entity');
    return html;
  }

  // 指标详情
  function buildIndicatorDetail(entity, typeLabel, typeColor) {
    let html = '';
    html += `<div class="detail-card"><h5>指标</h5>`;
    html += `<div class="attr-row"><span class="attr-key">名称</span><span class="attr-val">${escapeHtml(entity.name)}</span></div>`;

    const ind = findEntityInData(entity.id, 'indicators');
    if (ind) {
      if (ind.type) {
        html += `<div class="attr-row"><span class="attr-key">类型</span><span class="attr-val">${escapeHtml(ind.type)}</span></div>`;
      }
      if (ind.value) {
        html += `<div class="attr-row"><span class="attr-key">值</span><span class="attr-val" style="font-weight:bold">${escapeHtml(ind.value)}${ind.unit ? ' ' + escapeHtml(ind.unit) : ''}</span></div>`;
      }
      if (ind.is_core) {
        html += `<div class="attr-row"><span class="attr-key">核心指标</span><span class="attr-val" style="color:#00ba7c;">★ 是</span></div>`;
      }
    }
    html += `</div>`;

    // 关联实体
    html += buildRelatedEntities(entity, 'indicator_entity');
    return html;
  }

  // 在 fullData 中查找节点详情
  function findEntityInData(entityId, dataKey) {
    if (!fullData || !fullData[dataKey]) return null;
    // 需要处理 ID 前缀
    const searchKey = entityId;
    return fullData[dataKey].find(item => item.id === searchKey || item.logic_id === entityId || item.framework_id === entityId || item.indicator_id === entityId);
  }

  // 关联实体卡片
  function buildRelatedEntities(entity, edgeType) {
    // edgeType 是 'logic_entity' 或 'indicator_entity'
    const edgeKey = edgeType === 'framework_entity' ? '' : edgeType === 'logic_entity' ? 'logic_entity_edges' : 'indicator_entity_edges';
    if (!edgeKey || !fullData || !fullData[edgeKey]) return '';
    const edges = fullData[edgeKey].filter(e => 
      e.from === entity.id || e.to === entity.id
    );
    if (edges.length === 0) return '';
    const typeLabels = {
      'logic_entity': '关联实体', 'indicator_entity': '关联实体',
    };
    const label = typeLabels[edgeType] || '关联实体';

    let html = `<div class="detail-card"><h5>${label} (${edges.length})</h5><div class="relation-list">`;
    edges.slice(0, 10).forEach(e => {
      const targetName = e.to === entity.id ? e.from_name : e.to_name;
      // 尝试从实体列表找中文名
      const targetId = e.to === entity.id ? e.from : e.to;
      const foundEntity = (fullData.all_entities || []).find(en => en.id === targetId);
      const displayName = foundEntity ? foundEntity.name : targetName;
      html += `<div class="relation-item" data-entity-id="${targetId}" data-rel-type="${e.type}">
        <span class="rel-type" style="background:#71767b">${e.type}</span>
        <span class="rel-target">${escapeHtml(displayName)}</span>
      </div>`;
    });
    if (edges.length > 10) {
      html += `<div style="font-size:11px;color:#71767b;padding:4px 8px;">… 还有 ${edges.length - 10} 个</div>`;
    }
    html += `</div></div>`;
    return html;
  }

  // 关系卡片
  function buildRelationCard(entity) {
    if (!fullData || !fullData.all_relations) return '';
    const entityRelations = fullData.all_relations.filter(r =>
      r.from === entity.id || r.to === entity.id
    );
    if (entityRelations.length === 0) return '';

    const byType = {};
    entityRelations.forEach(r => {
      const key = r.type;
      if (!byType[key]) byType[key] = [];
      byType[key].push(r);
    });

    let html = `<div class="detail-card"><h5>相关关系 (${entityRelations.length})</h5><div class="relation-list">`;
    Object.entries(byType).forEach(([relType, rels]) => {
      const label = getRelLabel(relType);
      const color = getRelationColor(relType);
      html += `<div style="margin-bottom:6px;">
        <div style="font-size:11px;color:#71767b;margin-bottom:2px;">${label} (${rels.length})</div>`;
      rels.slice(0, 5).forEach(r => {
        const target = r.from === entity.id ? r.to_name : r.from_name;
        const targetId = r.from === entity.id ? r.to : r.from;
        html += `<div class="relation-item" data-entity-id="${targetId}" data-rel-type="${relType}">
          <span class="rel-type" style="background:${color}">${relType}</span>
          <span class="rel-target">${escapeHtml(target)}</span>
        </div>`;
      });
      if (rels.length > 5) {
        html += `<div style="font-size:11px;color:#71767b;padding:4px 8px;">… 还有 ${rels.length - 5} 个</div>`;
      }
      html += `</div>`;
    });
    html += `</div></div>`;
    return html;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;');
  }

  function safeFilename(name) {
    return name.replace(/[\s\n]+/g, '_').slice(0, 50);
  }

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

  function hide() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.add('hidden');
    currentEntity = null;
  }

  function close() {
    hide();
    currentEntity = null;
  }

  function setData(data) {
    fullData = data;
    industryData = null;
  }

  // 设置行业分片数据（分片加载模式用）
  function setIndustryData(data) {
    industryData = data;
    fullData = data; // 兼容旧版查找逻辑
  }

  function getCurrentEntity() { return currentEntity; }

  return {
    showDetail,
    hide,
    close,
    setData,
    setIndustryData,
    getCurrentEntity,
  };
})();