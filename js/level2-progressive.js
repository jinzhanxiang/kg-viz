/**
 * level2-progressive.js — Level 2: 行业内部渐进加载视图
 * 
 * 点击行业后，渐进式加载该行业内部的实体和关系。
 * 加载顺序：核心实体 → 全部实体 → 关系网络。
 * 支持进一步钻取到 Level 3。
 */

const Level2Progressive = (function() {
  let network = null;
  let nodes = null;
  let edges = null;
  let currentIndustry = null;
  let currentData = null;

  const NETWORK_OPTIONS = {
    nodes: {
      font: { size: 11, color: '#e7e9ea', face: 'Arial', strokeWidth: 1, strokeColor: '#000' },
      borderWidth: 1,
      shadow: { enabled: true, size: 5, color: 'rgba(0,0,0,0.4)' },
    },
    edges: {
      smooth: { type: 'continuous', roundness: 0.2 },
      font: { size: 9, color: '#71767b', face: 'Arial' },
      arrows: { to: { enabled: true, scaleFactor: 0.6 } },
    },
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -80,
        centralGravity: 0.01,
        springLength: 150,
        springConstant: 0.02,
        damping: 0.5,
        avoidOverlap: 0.5,
      },
      stabilization: { iterations: 100 },
    },
    interaction: { hover: true, tooltipDelay: 150 },
  };

  // 实体类型配色
  const TYPE_COLORS = {
    ORG: '#4A90D9', PERSON: '#50C878', PRODUCT: '#FFB347',
    TECH: '#FF6B6B', INDUSTRY: '#FFD700', POLICY: '#FF8C42',
    PLACE: '#48C9B0', UNKNOWN: '#95A5A6',
  };

  function getEntityColor(type) {
    return TYPE_COLORS[type] || TYPE_COLORS[type.toUpperCase()] || '#95A5A6';
  }

  function getEntityTypeLabel(type) {
    const labels = {
      ORG: '组织', PERSON: '人物', PRODUCT: '产品',
      TECH: '技术', INDUSTRY: '行业', POLICY: '政策',
      PLACE: '地点', UNKNOWN: '未知',
    };
    return labels[type] || labels[type.toUpperCase()] || type;
  }

  // 构建行业内部节点和边
  function buildIndustryData(industryName, fullData) {
    const industryMap = fullData.industries_map[industryName];
    if (!industryMap) return { nodes: [], edges: [], entityCount: 0, relationCount: 0 };

    const entityNodes = [];
    const edgeMap = new Map();

    // 实体节点
    industryMap.entities.forEach(e => {
      const color = getEntityColor(e.type);
      entityNodes.push({
        id: e.id,
        label: e.name.length > 12 ? e.name.slice(0, 12) + '…' : e.name,
        title: `${e.name}\n类型: ${getEntityTypeLabel(e.type)}\n${e.desc}`,
        shape: e.type === 'ORG' ? 'box' : e.type === 'PERSON' ? 'ellipse' :
               e.type === 'TECH' ? 'triangle' : e.type === 'POLICY' ? 'square' : 'diamond',
        color: {
          background: color,
          border: adjustColor(color, -30),
          highlight: { background: '#fff', border: '#1d9bf0' },
        },
        size: e.is_core ? 20 : 12,
        level: e.is_core ? 0 : 1,
        type: e.type,
        name: e.name,
        desc: e.desc,
        attrs: e.attrs,
        stock: e.stock,
        is_core: e.is_core,
        industry: industryName,
      });
    });

    // 边
    industryMap.relations.forEach(r => {
      const key = `${r.from}|${r.to}|${r.type}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { from: r.from, to: r.to, type: r.type, count: 1 });
      } else {
        edgeMap.get(key).count++;
      }
    });

    const industryEdges = [];
    edgeMap.forEach(edge => {
      const color = getRelationColor(edge.type);
      industryEdges.push({
        from: edge.from,
        to: edge.to,
        label: edge.count > 1 ? `${edge.count}` : '',
        color: { color: color, highlight: '#1d9bf0', opacity: 0.8 },
        width: Math.min(edge.count / 2 + 1, 3),
        smooth: { type: 'continuous', roundness: 0.15 },
      });
    });

    return {
      nodes: entityNodes,
      edges: industryEdges,
      entityCount: industryMap.entity_count,
      relationCount: industryMap.relation_count,
    };
  }

  // 关系类型配色
  const REL_PALETTE = [
    '#E74C3C', '#F39C12', '#2ECC71', '#3498DB', '#9B59B6',
    '#1ABC9C', '#E67E22', '#E91E63', '#00BCD4', '#FF9800',
    '#8E44AD', '#FF7043', '#00ACC1', '#7E57C2', '#27AE60',
    '#D32F2F', '#388E3C', '#1976D2', '#7B1FA2', '#00796B',
  ];

  function getRelationColor(type) {
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    return REL_PALETTE[Math.abs(hash) % REL_PALETTE.length];
  }

  // 颜色调整（变暗/变亮）
  function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `rgb(${r},${g},${b})`;
  }

  // 渐进式加载
  async function loadIndustry(industryName, fullData, container, onProgress) {
    currentIndustry = industryName;
    currentData = fullData;

    const containerEl = document.getElementById(container);
    containerEl.innerHTML = '';

    // 阶段1：仅加载核心实体
    const full = buildIndustryData(industryName, fullData);
    const coreNodes = full.nodes.filter(n => n.is_core);
    const coreIds = new Set(coreNodes.map(n => n.id));
    const coreEdges = full.edges.filter(e => coreIds.has(e.from) && coreIds.has(e.to));

    nodes = new vis.DataSet(coreNodes);
    edges = new vis.DataSet(coreEdges);

    network = new vis.Network(containerEl, { nodes, edges }, NETWORK_OPTIONS);

    if (onProgress) onProgress(`已加载 ${coreNodes.length} 个核心实体`);

    // 阶段2：加载全部实体（延迟）
    await sleep(600);
    nodes.add(full.nodes.filter(n => !n.is_core));
    if (onProgress) onProgress(`已加载全部 ${full.nodes.length} 个实体`);

    // 阶段3：加载全部关系
    await sleep(400);
    edges.add(full.edges.filter(e => !coreIds.has(e.from) || !coreIds.has(e.to)));
    if (onProgress) onProgress(`已加载 ${full.edges.length} 条关系`);

    // 节点点击 → Level 3
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        if (node && node.type !== 'industry') {
          if (window.onEnterLevel3) {
            window.onEnterLevel3(node);
          }
        }
      }
    });

    // 双击进入详情
    network.on('doubleClick', function(params) {
      if (params.nodes.length > 0) {
        const node = nodes.get(params.nodes[0]);
        if (node && node.type !== 'industry' && window.onEnterLevel3) {
          window.onEnterLevel3(node);
        }
      }
    });

    // 适应视图
    network.once('stabilizationIterationsDone', function() {
      network.fit({ animation: { duration: 500 } });
    });

    window.addEventListener('resize', () => network.fit());

    return { network, nodes, edges, data: full };
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // 返回到 Level 1
  function reset() {
    currentIndustry = null;
    currentData = null;
    if (network) {
      network.destroy();
      network = null;
    }
    nodes = null;
    edges = null;
  }

  // 高亮与选中
  function highlightEntity(entityId) {
    if (!network || !nodes) return;
    const allNodes = nodes.get({ filter: n => n.id !== entityId });
    const targetNode = nodes.get(entityId);

    // 淡化其他节点
    allNodes.forEach(n => {
      nodes.update({ id: n.id, opacity: 0.2, color: { opacity: 0.2 } });
    });

    // 高亮目标
    if (targetNode) {
      nodes.update({
        id: entityId,
        opacity: 1,
        color: {
          background: targetNode.color.background,
          border: '#fff',
          highlight: { background: '#fff', border: '#1d9bf0' },
        },
        borderWidth: 3,
      });
    }

    // 高亮关联边
    const connectedEdges = edges.get({
      filter: e => e.from === entityId || e.to === entityId,
    });
    edges.update(connectedEdges.map(e => ({
      id: e.id,
      color: { color: '#FFD700', highlight: '#FF6B00', opacity: 1 },
      width: 3,
    })));

    // 淡化其他边
    const otherEdges = edges.get({
      filter: e => e.from !== entityId && e.to !== entityId,
    });
    edges.update(otherEdges.map(e => ({
      id: e.id,
      color: { opacity: 0.1 },
      width: 0.5,
    })));
  }

  function clearHighlight() {
    if (!network || !nodes || !edges) return;
    nodes.forEach(n => {
      nodes.update({ id: n.id, opacity: 1, borderWidth: n.is_core ? 2 : 1 });
    });
    edges.forEach(e => {
      edges.update({ id: e.id, color: { opacity: 0.8 }, width: 1.5 });
    });
  }

  function getCurrentIndustry() { return currentIndustry; }
  function getNetwork() { return network; }

  return {
    loadIndustry,
    reset,
    highlightEntity,
    clearHighlight,
    getCurrentIndustry,
    getNetwork,
  };
})();
