/**
 * level2-progressive.js — Level 2: 行业内部渐进加载视图 v4
 * 
 * 点击行业后，渐进式加载该行业内部的所有节点（实体/框架/逻辑链/指标）
 * 和边（实体关系/逻辑关联/指标关联）。
 * 
 * v4 改进：
 * - 支持框架/逻辑/指标节点类型
 * - 按实体类型分组聚类（避免散点）
 * - 更好的物理引擎
 * - 按类型分组显示
 */

const Level2Progressive = (function() {
  let network = null;
  let nodes = null;
  let edges = null;
  let currentIndustry = null;
  let currentData = null;
  let clusteringActive = true;

  const NETWORK_OPTIONS = {
    nodes: {
      font: { size: 11, color: '#e7e9ea', face: 'Arial', strokeWidth: 1, strokeColor: '#000' },
      borderWidth: 1,
      shadow: { enabled: true, size: 5, color: 'rgba(0,0,0,0.4)' },
    },
    edges: {
      smooth: { type: 'continuous', roundness: 0.2 },
      font: { size: 8, color: '#71767b', face: 'Arial', strokeWidth: 0 },
      arrows: { to: { enabled: false } },
    },
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -120,
        centralGravity: 0.005,
        springLength: 180,
        springConstant: 0.01,
        damping: 0.6,
        avoidOverlap: 1.0,
      },
      stabilization: { iterations: 150 },
    },
    interaction: { hover: true, tooltipDelay: 100, navigationButtons: false },
    groups: {
      entity: { shape: 'dot', size: 12 },
      framework: { shape: 'square', size: 18, borderWidth: 2 },
      logic: { shape: 'triangle', size: 10 },
      indicator: { shape: 'diamond', size: 8 },
    },
  };

  // 完整实体类型配色
  const TYPE_COLORS = {
    ORG: '#4A90D9', PERSON: '#50C878', PRODUCT: '#FFB347',
    TECH: '#FF6B6B', INDUSTRY: '#FFD700', POLICY: '#FF8C42',
    PLACE: '#48C9B0', UNKNOWN: '#95A5A6',
    framework: '#F39C12', indicator: '#2ECC71',
    logic: '#9B59B6', report: '#95A5A6',
  };

  // 中文类型标签
  const TYPE_LABELS = {
    ORG: '组织', PERSON: '人物', PRODUCT: '产品',
    TECH: '技术', INDUSTRY: '行业', POLICY: '政策',
    PLACE: '地点', UNKNOWN: '未知',
    framework: '研究框架', indicator: '指标',
    logic: '逻辑链', report: '报告',
  };

  // 节点形状映射
  const TYPE_SHAPES = {
    ORG: 'box', PERSON: 'ellipse', PRODUCT: 'hexagon',
    TECH: 'triangle', INDUSTRY: 'star', POLICY: 'square',
    PLACE: 'diamond', UNKNOWN: 'dot',
    framework: 'square', indicator: 'diamond',
    logic: 'triangle', report: 'dot',
  };

  function getEntityColor(type) {
    return TYPE_COLORS[type] || TYPE_COLORS[type.toUpperCase()] || '#95A5A6';
  }

  function getEntityTypeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS[type.toUpperCase()] || type;
  }

  function getShape(type) {
    return TYPE_SHAPES[type] || TYPE_SHAPES[type.toUpperCase()] || 'dot';
  }

  // 构建行业内部节点和边（使用 all_nodes/all_edges 或兼容旧数据）
  function buildIndustryData(industryName, fullData, showIsolated) {
    const industryMap = fullData.industries_map[industryName];
    if (!industryMap) return { nodes: [], edges: [], entityCount: 0, relationCount: 0 };

    // 新数据：使用 all_nodes 和 all_edges
    if (industryMap.all_nodes && industryMap.all_edges) {
      return buildNodesFromAllData(industryMap, showIsolated);
    }

    // 旧数据兼容：使用 entities + relations
    return buildNodesFromLegacyData(industryMap, showIsolated);
  }

  // 新数据版本（v4+）
  function buildNodesFromAllData(industryMap, showIsolated) {
    const allNodes = industryMap.all_nodes || [];
    const allEdges = industryMap.all_edges || [];

    // 统计有关系的节点 ID
    const connectedIds = new Set();
    allEdges.forEach(e => {
      connectedIds.add(e.from);
      connectedIds.add(e.to);
    });

    const entityNodes = [];
    const edgeMap = new Map();

    allNodes.forEach(n => {
      // 可选过滤孤立节点
      if (showIsolated !== true && !connectedIds.has(n.id)) return;

      const color = getEntityColor(n.type);
      const isFramework = n.node_type === 'framework';
      const isLogic = n.node_type === 'logic';
      const isIndicator = n.node_type === 'indicator';

      // 节点大小：核心实体和框架较大，逻辑链和指标较小
      let size = 12;
      if (n.is_core && n.node_type === 'entity') size = 20;
      else if (isFramework) size = 18;
      else if (isLogic) size = 10;
      else if (isIndicator) size = 8;

      entityNodes.push({
        id: n.id,
        label: n.label.length > 15 ? n.label.slice(0, 15) + '…' : n.label,
        title: buildTooltip(n, industryMap),
        shape: getShape(n.type),
        group: n.node_type || 'entity',
        color: {
          background: color,
          border: adjustColor(color, -40),
          highlight: { background: '#fff', border: '#1d9bf0' },
        },
        size: size,
        level: n.is_core ? 0 : 1,
        type: n.type,
        nodeType: n.node_type,
        name: n.label,
        is_core: n.is_core,
        industry: n.industry || '',
      });
    });

    // 边
    allEdges.forEach(e => {
      const key = `${e.from}|${e.to}|${e.type}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { from: e.from, to: e.to, type: e.type, count: 1, edgeType: e.edge_type || 'entity_relation' });
      } else {
        edgeMap.get(key).count++;
      }
    });

    const industryEdges = [];
    edgeMap.forEach(edge => {
      const color = getRelationColor(edge.type);
      const isNonEntityEdge = edge.edgeType === 'logic_entity' || edge.edgeType === 'indicator_entity';
      industryEdges.push({
        from: edge.from,
        to: edge.to,
        label: edge.count > 1 ? `${edge.count}` : '',
        color: {
          color: color,
          highlight: '#1d9bf0',
          opacity: isNonEntityEdge ? 0.4 : 0.8,
        },
        width: isNonEntityEdge ? 0.8 : Math.min(edge.count / 2 + 1, 3),
        dashes: isNonEntityEdge ? [5, 3] : false,  // 非实体关系用虚线
        smooth: { type: 'continuous', roundness: 0.15 },
      });
    });

    return {
      nodes: entityNodes,
      edges: industryEdges,
      entityCount: industryMap.entity_count || 0,
      relationCount: industryMap.relation_count || 0,
      frameworkCount: industryMap.framework_count || 0,
      logicCount: industryMap.logic_count || 0,
      indicatorCount: industryMap.indicator_count || 0,
    };
  }

  // 构建 tooltip
  function buildTooltip(node, industryMap) {
    let lines = [`${node.label}`];
    lines.push(`类型: ${getEntityTypeLabel(node.type)}`);
    
    if (node.node_type === 'entity') {
      // 查找实体的描述
      const found = (industryMap.entities || []).find(e => e.id === node.id);
      if (found && found.desc) {
        lines.push(`描述: ${found.desc.slice(0, 100)}`);
      }
    } else if (node.node_type === 'framework') {
      const found = (industryMap.frameworks || []).find(f => f.id === node.id);
      if (found) {
        if (found.category) lines.push(`分类: ${found.category}`);
        if (found.content) lines.push(`内容: ${found.content.slice(0, 150)}`);
        lines.push(`置信度: ${(found.confidence * 100).toFixed(0)}%`);
      }
    } else if (node.node_type === 'logic') {
      const found = (industryMap.logics || []).find(l => l.id === node.id);
      if (found) {
        if (found.premise) lines.push(`前提: ${found.premise.slice(0, 80)}`);
        if (found.conclusion) lines.push(`结论: ${found.conclusion.slice(0, 80)}`);
      }
    } else if (node.node_type === 'indicator') {
      const found = (industryMap.indicators || []).find(i => i.id === node.id);
      if (found) {
        if (found.value) lines.push(`值: ${found.value}${found.unit || ''}`);
        if (found.type) lines.push(`类型: ${found.type}`);
      }
    }
    return lines.join('\n');
  }

  // 旧数据版本兼容
  function buildNodesFromLegacyData(industryMap, showIsolated) {
    const connectedIds = new Set();
    industryMap.relations.forEach(r => {
      connectedIds.add(r.from);
      connectedIds.add(r.to);
    });

    const entityNodes = [];
    const edgeMap = new Map();

    industryMap.entities.forEach(e => {
      if (showIsolated !== true && !connectedIds.has(e.id)) return;
      const color = getEntityColor(e.type);
      entityNodes.push({
        id: e.id,
        label: e.name.length > 12 ? e.name.slice(0, 12) + '…' : e.name,
        title: `${e.name}\n类型: ${getEntityTypeLabel(e.type)}\n${e.desc}`,
        shape: getShape(e.type),
        group: 'entity',
        color: {
          background: color,
          border: adjustColor(color, -30),
          highlight: { background: '#fff', border: '#1d9bf0' },
        },
        size: e.is_core ? 20 : 12,
        level: e.is_core ? 0 : 1,
        type: e.type,
        nodeType: 'entity',
        name: e.name,
        desc: e.desc,
        is_core: e.is_core,
        industry: industryMap.industry || '',
      });
    });

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
      entityCount: industryMap.entity_count || 0,
      relationCount: industryMap.relation_count || 0,
      frameworkCount: 0, logicCount: 0, indicatorCount: 0,
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

  function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `rgb(${r},${g},${b})`;
  }

  // 按实体类型聚类
  function applyTypeClustering(network, nodes) {
    if (!clusteringActive) return;
    
    // 对非实体节点按类型聚类
    const nodeTypes = {};
    nodes.forEach(n => {
      if (n.nodeType !== 'entity') {
        const typeKey = n.nodeType || 'other';
        if (!nodeTypes[typeKey]) nodeTypes[typeKey] = [];
        nodeTypes[typeKey].push(n.id);
      }
    });

    // 聚类逻辑链（数量通常很多，必须聚类）
    Object.keys(nodeTypes).forEach(typeKey => {
      const ids = nodeTypes[typeKey];
      if (ids.length < 3) return; // 太少不聚类
      
      const typeLabel = TYPE_LABELS[typeKey] || typeKey;
      const color = TYPE_COLORS[typeKey] || '#95A5A6';
      
      network.cluster({
        joinCondition: (nodeOptions) => {
          return ids.includes(nodeOptions.id);
        },
        clusterNodeProperties: {
          id: `cluster_${typeKey}`,
          label: `${typeLabel} (${ids.length})`,
          shape: typeKey === 'framework' ? 'square' : 
                 typeKey === 'logic' ? 'triangle' : 'diamond',
          size: Math.min(ids.length * 0.5 + 25, 50),
          color: {
            background: color,
            border: adjustColor(color, -40),
            highlight: { background: '#fff', border: '#1d9bf0' },
          },
          font: { size: 14, color: '#e7e9ea', face: 'Arial' },
        },
        clusterEdgeProperties: {
          color: { color: adjustColor(color, -20), opacity: 0.3 },
          width: 0.8,
          dashes: [3, 3],
        },
      });
    });

    // 对同类型实体按行业子类聚类（如果该行业实体超500）
    const entityIds = [];
    nodes.forEach(n => {
      if (n.nodeType === 'entity') entityIds.push(n.id);
    });
    if (entityIds.length > 500) {
      // 按类型聚类主体
      const entByType = {};
      nodes.forEach(n => {
        if (n.nodeType === 'entity') {
          const t = n.type || 'UNKNOWN';
          if (!entByType[t]) entByType[t] = [];
          entByType[t].push(n.id);
        }
      });
      Object.keys(entByType).forEach(typeKey => {
        const ids = entByType[typeKey];
        if (ids.length < 50) return;
        const typeLabel = TYPE_LABELS[typeKey] || typeKey;
        const color = TYPE_COLORS[typeKey] || '#95A5A6';
        network.cluster({
          joinCondition: (nodeOptions) => ids.includes(nodeOptions.id),
          clusterNodeProperties: {
            id: `cluster_entity_${typeKey}`,
            label: `${typeLabel}主体 (${ids.length})`,
            shape: getShape(typeKey),
            size: Math.min(ids.length * 0.3 + 30, 55),
            color: {
              background: color,
              border: adjustColor(color, -40),
              highlight: { background: '#fff', border: '#1d9bf0' },
            },
            font: { size: 14, color: '#e7e9ea', face: 'Arial' },
          },
          clusterEdgeProperties: {
            color: { color: adjustColor(color, -20), opacity: 0.2 },
            width: 0.5,
          },
        });
      });
    }
  }

  // 渐进式加载
  async function loadIndustry(industryName, fullData, container, onProgress) {
    currentIndustry = industryName;
    currentData = fullData;

    const containerEl = document.getElementById(container);
    containerEl.innerHTML = '';

    const showIsolated = window._showIsolatedNodes === true;
    const full = buildIndustryData(industryName, fullData, showIsolated);

    // 阶段1：仅加载核心实体和框架（先展示骨架）
    const coreNodes = full.nodes.filter(n => n.is_core || n.nodeType === 'framework');
    const coreIds = new Set(coreNodes.map(n => n.id));
    const coreEdges = full.edges.filter(e => coreIds.has(e.from) && coreIds.has(e.to));

    nodes = new vis.DataSet(coreNodes);
    edges = new vis.DataSet(coreEdges);

    containerEl.innerHTML = '';
    network = new vis.Network(containerEl, { nodes, edges }, NETWORK_OPTIONS);

    if (onProgress) onProgress(`已加载 ${coreNodes.length} 个核心节点`);

    // 阶段2：加载全部节点（延迟）
    await sleep(800);
    const remainingNodes = full.nodes.filter(n => !n.is_core);
    if (remainingNodes.length > 0) {
      nodes.add(remainingNodes);
    }
    if (onProgress) onProgress(`已加载 ${full.nodes.length} 个节点`);

    // 阶段3：加载全部边
    await sleep(600);
    const remainingEdges = full.edges.filter(e => !coreIds.has(e.from) || !coreIds.has(e.to));
    if (remainingEdges.length > 0) {
      edges.add(remainingEdges);
    }
    if (onProgress) onProgress(`已加载 ${full.edges.length} 条关系`);

    // 阶段4：按类型聚类（减少视觉杂乱）
    await sleep(1200);
    applyTypeClustering(network, nodes);

    // 节点点击 → Level 3
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        if (node) {
          if (window.onEnterLevel3) {
            window.onEnterLevel3(node);
          }
        }
      }
    });

    // 双击展开聚类
    network.on('doubleClick', function(params) {
      if (params.nodes.length > 0) {
        const clusterId = params.nodes[0];
        if (network.isCluster(clusterId)) {
          network.openCluster(clusterId);
          return;
        }
        const node = nodes.get(clusterId);
        if (node && window.onEnterLevel3) {
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

  function highlightEntity(entityId) {
    if (!network || !nodes) return;
    const allNodes = nodes.get({ filter: n => n.id !== entityId });
    const targetNode = nodes.get(entityId);

    allNodes.forEach(n => {
      nodes.update({ id: n.id, opacity: 0.2, color: { opacity: 0.2 } });
    });

    if (targetNode) {
      nodes.update({
        id: entityId,
        opacity: 1,
        color: { background: targetNode.color.background, border: '#fff', highlight: { background: '#fff', border: '#1d9bf0' } },
        borderWidth: 3,
      });
    }

    const connectedEdges = edges.get({ filter: e => e.from === entityId || e.to === entityId });
    edges.update(connectedEdges.map(e => ({
      id: e.id,
      color: { color: '#FFD700', highlight: '#FF6B00', opacity: 1 },
      width: 3,
    })));

    const otherEdges = edges.get({ filter: e => e.from !== entityId && e.to !== entityId });
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