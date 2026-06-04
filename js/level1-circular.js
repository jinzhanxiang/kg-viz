/**
 * level1-circular.js — Level 1: 环形行业全景图
 * 
 * 将9个行业按环形排列，每个行业节点显示名称和实体数。
 * 点击行业节点进入 Level 2。
 */

const Level1Circular = (function() {
  let network = null;
  let nodes = null;
  let edges = null;
  let data = null;

  // vis-network 配置
  const NETWORK_OPTIONS = {
    nodes: {
      font: { size: 12, color: '#e7e9ea', face: 'Arial', strokeWidth: 1, strokeColor: '#000' },
      borderWidth: 2,
      shadow: { enabled: true, size: 10, color: 'rgba(0,0,0,0.5)' },
    },
    edges: {
      smooth: { type: 'continuous', roundness: 0.3 },
      font: { size: 10, color: '#71767b', face: 'Arial' },
      arrows: { to: { enabled: true, scaleFactor: 0.8 } },
    },
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -50,
        centralGravity: 0.005,
        springLength: 200,
        springConstant: 0.01,
        damping: 0.4,
        avoidOverlap: 0.3,
      },
      stabilization: { iterations: 200 },
    },
    interaction: { hover: true, tooltipDelay: 200 },
    layout: { randomSeed: 42 },
  };

  // 行业环形布局位置计算
  function computeCircularPositions(count) {
    const positions = [];
    const cx = 0, cy = 0;
    const radius = 350;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i / count) - Math.PI / 2;
      positions.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    }
    return positions;
  }

  // 行业节点颜色（基于实体数）
  function getIndustryColor(count, maxCount) {
    const intensity = Math.min(count / maxCount, 1);
    const r = Math.round(29 + intensity * 168);
    const g = Math.round(155 + intensity * 41);
    const b = Math.round(240 + intensity * 0);
    return `rgb(${r},${g},${b})`;
  }

  // 构建 Level 1 数据
  function buildLevel1Data(summary) {
    const industryNodes = [];
    const industryEdges = [];
    const maxCount = Math.max(...summary.industries.map(i => i.count));

    const positions = computeCircularPositions(summary.industries.length);

    summary.industries.forEach((ind, i) => {
      const pos = positions[i];
      const size = Math.max(25, Math.min(45, ind.count / maxCount * 40 + 25));

      industryNodes.push({
        id: `ind_${ind.name}`,
        label: `${ind.name}\n(${ind.count})`,
        title: `行业：${ind.name}\n实体数量：${ind.count}`,
        shape: 'ellipse',
        color: {
          background: getIndustryColor(ind.count, maxCount),
          border: '#1a8cd8',
          highlight: { background: '#fff', border: '#1d9bf0' },
        },
        size: size,
        x: pos.x,
        y: pos.y,
        level: 0,
        type: 'industry',
        name: ind.name,
        count: ind.count,
      });
    });

    // 行业之间用边连接（基于跨行业关系）
    // 如果全量数据未加载（分片模式），跳过跨行业边
    let crossIndustryRelations = [];
    if (data && data.all_relations) {
      crossIndustryRelations = data.all_relations.filter(r =>
        r.from_ind && r.to_ind && r.from_ind !== r.to_ind
      );
    }
    const crossPairs = new Map();
    crossIndustryRelations.forEach(r => {
      const key = [r.from_ind, r.to_ind].sort().join('|');
      crossPairs.set(key, (crossPairs.get(key) || 0) + 1);
    });

    crossPairs.forEach((count, pair) => {
      const [a, b] = pair.split('|');
      industryEdges.push({
        from: `ind_${a}`,
        to: `ind_${b}`,
        label: count > 5 ? `${count}` : '',
        color: { color: '#304455', highlight: '#1d9bf0' },
        width: Math.min(count / 10, 3),
        dashes: true,
        smooth: { type: 'cubicBezier', roundness: 0.2 },
      });
    });

    return { nodes: industryNodes, edges: industryEdges };
  }

  // 初始化
  function init(container, summary, fullData) {
    data = fullData;
    const l1Data = buildLevel1Data(summary);

    nodes = new vis.DataSet(l1Data.nodes);
    edges = new vis.DataSet(l1Data.edges);

    const containerEl = document.getElementById(container);
    containerEl.innerHTML = '';

    network = new vis.Network(containerEl, { nodes, edges }, NETWORK_OPTIONS);

    // 节点点击事件
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        if (node && node.type === 'industry') {
          // 触发进入 Level 2 的事件
          if (window.onEnterLevel2) {
            window.onEnterLevel2(node.name, node.count);
          }
        }
      }
    });

    // 双击节点放大
    network.on('doubleClick', function(params) {
      if (params.nodes.length > 0) {
        const node = nodes.get(params.nodes[0]);
        if (node && node.type === 'industry') {
          if (window.onEnterLevel2) {
            window.onEnterLevel2(node.name, node.count);
          }
        }
      }
    });

    // 窗口自适应
    window.addEventListener('resize', () => network.fit({ animation: { duration: 300 } }));

    return network;
  }

  // 获取当前选中的行业
  function getSelectedIndustry() {
    const selected = network.getSelection().nodes;
    if (selected.length > 0) {
      return nodes.get(selected[0]);
    }
    return null;
  }

  // 聚焦到特定行业
  function focusOnIndustry(industryName) {
    const nodeId = `ind_${industryName}`;
    if (nodes.get(nodeId)) {
      network.focus(nodeId, {
        scale: 1.5,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' },
      });
    }
  }

  // 更新状态
  function updateStatus() {
    const selected = getSelectedIndustry();
    if (selected) {
      return `选中行业: ${selected.name} (${selected.count} 实体)`;
    }
    return `Level 1 · 点击行业节点进入详情`;
  }

  return {
    init,
    getSelectedIndustry,
    focusOnIndustry,
    updateStatus,
  };
})();
