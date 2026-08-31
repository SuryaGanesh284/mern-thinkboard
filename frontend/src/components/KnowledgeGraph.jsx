import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { NetworkIcon, ZoomInIcon, ZoomOutIcon, RotateCcwIcon, ExternalLinkIcon, SparklesIcon } from "lucide-react";
import api from "../lib/axios";

const NODE_COLORS = [
  "#00FF9D", // Neon green (ThinkBoard primary)
  "#38BDF8", // Sky blue
  "#A855F7", // Purple
  "#F43F5E", // Rose
  "#FBBF24", // Amber
  "#34D399", // Emerald
];

const KnowledgeGraph = () => {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();

  // Animation and physics simulation state
  const simulationRef = useRef({
    nodes: [],
    links: [],
    animId: null,
    dragNode: null,
    isPanning: false,
    startPan: { x: 0, y: 0 },
  });

  // Fetch graph data from backend
  useEffect(() => {
    const fetchGraph = async () => {
      setLoading(true);
      try {
        const res = await api.get("/ai/knowledge-graph");
        const data = res.data || { nodes: [], links: [] };
        setGraphData(data);
      } catch (err) {
        console.error("Failed to load knowledge graph:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, []);

  // Initialize Canvas physics & render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.parentElement.clientWidth;
    const height = 540;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Initialize node positions in a circle/cluster
    const nodes = graphData.nodes.map((n, i) => {
      const angle = (i / graphData.nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.32;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        radius: 18,
        color: NODE_COLORS[i % NODE_COLORS.length],
      };
    });

    const links = graphData.links.map((l) => ({
      ...l,
      sourceNode: nodes.find((n) => n.id === l.source) || nodes[0],
      targetNode: nodes.find((n) => n.id === l.target) || nodes[1],
    }));

    simulationRef.current.nodes = nodes;
    simulationRef.current.links = links;

    // Simulation loop
    let running = true;
    const runSimulation = () => {
      if (!running) return;

      // 1. Apply spring forces for links
      for (const link of links) {
        const dx = link.targetNode.x - link.sourceNode.x;
        const dy = link.targetNode.y - link.sourceNode.y;
        const dist = Math.sqrt(dx * dy + dy * dy) || 1;
        const targetDist = 140 - (link.similarity || 50) * 0.6;
        const force = (dist - targetDist) * 0.008;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        link.sourceNode.vx += fx;
        link.sourceNode.vy += fy;
        link.targetNode.vx -= fx;
        link.targetNode.vy -= fy;
      }

      // 2. Apply repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 220) {
            const force = -(220 - dist) / dist * 0.04;
            nodes[i].vx += (dx / dist) * force;
            nodes[i].vy += (dy / dist) * force;
            nodes[j].vx -= (dx / dist) * force;
            nodes[j].vy -= (dy / dist) * force;
          }
        }
      }

      // 3. Center gravity force
      const cx = width / 2;
      const cy = height / 2;
      for (const node of nodes) {
        if (node !== simulationRef.current.dragNode) {
          node.vx += (cx - node.x) * 0.001;
          node.vy += (cy - node.y) * 0.001;
          node.vx *= 0.92; // Damping
          node.vy *= 0.92;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      // 4. Render canvas frame
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw background grid lines for second-brain cyber aesthetic
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = -width; x < width * 2; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -height);
        ctx.lineTo(x, height * 2);
        ctx.stroke();
      }
      for (let y = -height; y < height * 2; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-width, y);
        ctx.lineTo(width * 2, y);
        ctx.stroke();
      }

      // Draw links
      for (const link of links) {
        ctx.beginPath();
        ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
        ctx.lineTo(link.targetNode.x, link.targetNode.y);

        const isHoveredLink =
          hoveredNode &&
          (link.sourceNode.id === hoveredNode.id || link.targetNode.id === hoveredNode.id);

        ctx.strokeStyle = isHoveredLink
          ? "rgba(0, 255, 157, 0.7)"
          : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = isHoveredLink ? 2.5 : Math.max(1, (link.value || 1) * 0.8);
        ctx.stroke();

        // Draw similarity tag on hovered links
        if (isHoveredLink) {
          const midX = (link.sourceNode.x + link.targetNode.x) / 2;
          const midY = (link.sourceNode.y + link.targetNode.y) / 2;
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.fillRect(midX - 16, midY - 9, 32, 18);
          ctx.fillStyle = "#00FF9D";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${link.similarity}%`, midX, midY + 3);
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const isConnected =
          hoveredNode &&
          links.some(
            (l) =>
              (l.sourceNode.id === hoveredNode.id && l.targetNode.id === node.id) ||
              (l.targetNode.id === hoveredNode.id && l.sourceNode.id === node.id)
          );

        // Node outer glow
        if (isHovered || isConnected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered ? "rgba(0, 255, 157, 0.25)" : "rgba(56, 189, 248, 0.2)";
          ctx.fill();
        }

        // Node Circle Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isHovered ? 18 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node Title Label
        ctx.font = isHovered ? "bold 13px sans-serif" : "11px sans-serif";
        ctx.fillStyle = isHovered ? "#00FF9D" : "rgba(255, 255, 255, 0.85)";
        ctx.textAlign = "center";
        const truncatedTitle =
          node.title.length > 18 ? node.title.substring(0, 16) + "…" : node.title;
        ctx.fillText(truncatedTitle, node.x, node.y + node.radius + 15);
      }

      ctx.restore();
      simulationRef.current.animId = requestAnimationFrame(runSimulation);
    };

    runSimulation();

    return () => {
      running = false;
      if (simulationRef.current.animId) {
        cancelAnimationFrame(simulationRef.current.animId);
      }
    };
  }, [graphData, zoom, pan, hoveredNode]);

  // Handle Canvas mouse events (drag, hover, click)
  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const x = (clientX - pan.x) / zoom;
    const y = (clientY - pan.y) / zoom;
    return { x, y, clientX, clientY };
  };

  const handleMouseDown = (e) => {
    const { x, y, clientX, clientY } = getCanvasCoords(e);
    const clickedNode = simulationRef.current.nodes.find(
      (n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4
    );

    if (clickedNode) {
      simulationRef.current.dragNode = clickedNode;
    } else {
      simulationRef.current.isPanning = true;
      simulationRef.current.startPan = { x: clientX - pan.x, y: clientY - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    const { x, y, clientX, clientY } = getCanvasCoords(e);

    if (simulationRef.current.dragNode) {
      simulationRef.current.dragNode.x = x;
      simulationRef.current.dragNode.y = y;
      simulationRef.current.dragNode.vx = 0;
      simulationRef.current.dragNode.vy = 0;
    } else if (simulationRef.current.isPanning) {
      setPan({
        x: clientX - simulationRef.current.startPan.x,
        y: clientY - simulationRef.current.startPan.y,
      });
    } else {
      const found = simulationRef.current.nodes.find(
        (n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4
      );
      setHoveredNode(found || null);
    }
  };

  const handleMouseUp = () => {
    simulationRef.current.dragNode = null;
    simulationRef.current.isPanning = false;
  };

  const handleClick = (e) => {
    const { x, y } = getCanvasCoords(e);
    const clickedNode = simulationRef.current.nodes.find(
      (n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4
    );
    if (clickedNode) {
      navigate(`/note/${clickedNode.id}`);
    }
  };

  return (
    <div className="relative w-full rounded-2xl bg-base-300/90 border border-primary/20 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-base-content/10 bg-base-200/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <NetworkIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              Semantic Knowledge Graph
              <span className="badge badge-primary badge-sm">Interactive 2D</span>
            </h3>
            <p className="text-xs opacity-60">
              Interactive visual map of your thoughts connected by AI semantic similarity
            </p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-base-100 p-1 rounded-xl border border-base-content/10">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            className="btn btn-ghost btn-xs btn-circle"
            title="Zoom In"
          >
            <ZoomInIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="btn btn-ghost btn-xs btn-circle"
            title="Zoom Out"
          >
            <ZoomOutIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="btn btn-ghost btn-xs btn-circle"
            title="Reset View"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative h-[540px] w-full bg-[#0d1117] cursor-grab active:cursor-grabbing">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-primary gap-2">
            <SparklesIcon className="size-6 animate-spin" />
            <span className="text-sm font-medium">Building semantic knowledge graph...</span>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-base-content/60">
            <NetworkIcon className="size-12 opacity-30 text-primary mb-2" />
            <p className="font-medium text-sm">No notes available yet to build graph</p>
            <p className="text-xs opacity-60">Create notes to see them connected here!</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
          />
        )}

        {/* Hovered Node Preview Tooltip */}
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 max-w-sm p-4 rounded-xl bg-base-100/95 border border-primary/40 shadow-2xl backdrop-blur-md animate-fadeIn pointer-events-none">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-bold text-sm text-primary line-clamp-1">{hoveredNode.title}</h4>
              <span className="badge badge-xs badge-outline">Click to open</span>
            </div>
            <p className="text-xs text-base-content/80 line-clamp-2">{hoveredNode.preview}...</p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-base-100/80 backdrop-blur-sm p-2.5 rounded-xl border border-base-content/10 text-[11px] space-y-1 text-base-content/70 hidden sm:block">
          <div className="flex items-center gap-1.5 font-medium text-base-content">
            <SparklesIcon className="size-3 text-primary" />
            <span>Graph Guide</span>
          </div>
          <p>• Nodes = Notes</p>
          <p>• Links = Semantic Similarity &gt; 45%</p>
          <p>• Drag to arrange, click node to open</p>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
