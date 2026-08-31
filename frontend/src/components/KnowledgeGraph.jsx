import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  NetworkIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateCcwIcon,
  SparklesIcon,
  RefreshCwIcon,
} from "lucide-react";
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
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(0);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const navigate = useNavigate();

  // Internal state kept in refs to avoid React re-renders interrupting the Canvas loop
  const stateRef = useRef({
    nodes: [],
    links: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    hoveredNode: null,
    dragNode: null,
    isPanning: false,
    startPan: { x: 0, y: 0 },
    hasDragged: false,
    animId: null,
  });

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/ai/knowledge-graph");
      const data = res.data || { nodes: [], links: [] };
      setNodeCount(data.nodes?.length || 0);
      initSimulation(data.nodes || [], data.links || []);
    } catch (err) {
      console.error("Failed to load knowledge graph:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
    return () => {
      if (stateRef.current.animId) {
        cancelAnimationFrame(stateRef.current.animId);
      }
    };
  }, []);

  const initSimulation = (rawNodes, rawLinks) => {
    if (!containerRef.current || rawNodes.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 540;

    // Distribute nodes evenly in a circle initially
    const nodes = rawNodes.map((n, i) => {
      const angle = (i / rawNodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.32;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: 18,
        color: NODE_COLORS[i % NODE_COLORS.length],
      };
    });

    const links = rawLinks
      .map((l) => ({
        ...l,
        sourceNode: nodes.find((n) => n.id === l.source),
        targetNode: nodes.find((n) => n.id === l.target),
      }))
      .filter((l) => l.sourceNode && l.targetNode);

    stateRef.current.nodes = nodes;
    stateRef.current.links = links;
    stateRef.current.zoom = 1;
    stateRef.current.pan = { x: 0, y: 0 };
    stateRef.current.hoveredNode = null;
    stateRef.current.dragNode = null;

    startLoop();
  };

  const startLoop = () => {
    if (stateRef.current.animId) {
      cancelAnimationFrame(stateRef.current.animId);
    }

    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext("2d");

    const render = () => {
      const { nodes, links, zoom, pan, hoveredNode, dragNode } = stateRef.current;
      const width = containerRef.current?.clientWidth || 800;
      const height = 540;

      // Adjust canvas resolution for high-DPI screens
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      // --- Physics Step ---
      // 1. Link springs
      for (const link of links) {
        const dx = link.targetNode.x - link.sourceNode.x;
        const dy = link.targetNode.y - link.sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 160 - (link.similarity || 50) * 0.8;
        const force = (dist - targetDist) * 0.006;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (link.sourceNode !== dragNode) {
          link.sourceNode.vx += fx;
          link.sourceNode.vy += fy;
        }
        if (link.targetNode !== dragNode) {
          link.targetNode.vx -= fx;
          link.targetNode.vy -= fy;
        }
      }

      // 2. Node repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 200) {
            const force = (-(200 - dist) / dist) * 0.035;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (nodes[i] !== dragNode) {
              nodes[i].vx += fx;
              nodes[i].vy += fy;
            }
            if (nodes[j] !== dragNode) {
              nodes[j].vx -= fx;
              nodes[j].vy -= fy;
            }
          }
        }
      }

      // 3. Center gravity & velocity dampening
      const cx = width / 2;
      const cy = height / 2;
      for (const node of nodes) {
        if (node !== dragNode) {
          node.vx += (cx - node.x) * 0.0008;
          node.vy += (cy - node.y) * 0.0008;
          node.vx *= 0.90; // Damping
          node.vy *= 0.90;
          node.x += node.vx;
          node.y += node.vy;
        }
      }

      // --- Drawing Step ---
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Apply Pan & Zoom
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      // Background Subtle Cyber Grid
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

      // Draw Links
      for (const link of links) {
        const isHoveredLink =
          hoveredNode &&
          (link.sourceNode.id === hoveredNode.id || link.targetNode.id === hoveredNode.id);

        ctx.beginPath();
        ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
        ctx.lineTo(link.targetNode.x, link.targetNode.y);

        ctx.strokeStyle = isHoveredLink
          ? "rgba(0, 255, 157, 0.85)"
          : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = isHoveredLink ? 2.5 : 1.2;
        ctx.stroke();

        // Draw badge on hovered connected links
        if (isHoveredLink) {
          const midX = (link.sourceNode.x + link.targetNode.x) / 2;
          const midY = (link.sourceNode.y + link.targetNode.y) / 2;
          ctx.fillStyle = "rgba(10, 15, 25, 0.9)";
          ctx.fillRect(midX - 16, midY - 9, 32, 18);
          ctx.strokeStyle = "rgba(0, 255, 157, 0.5)";
          ctx.lineWidth = 1;
          ctx.strokeRect(midX - 16, midY - 9, 32, 18);

          ctx.fillStyle = "#00FF9D";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${link.similarity}%`, midX, midY);
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const isConnected =
          hoveredNode &&
          links.some(
            (l) =>
              (l.sourceNode.id === hoveredNode.id && l.targetNode.id === node.id) ||
              (l.targetNode.id === hoveredNode.id && l.sourceNode.id === node.id)
          );

        // Node Glow Ring
        if (isHovered || isConnected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered ? "rgba(0, 255, 157, 0.3)" : "rgba(56, 189, 248, 0.2)";
          ctx.fill();
        }

        // Node Body
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

        // Node Title Text
        ctx.font = isHovered ? "bold 13px sans-serif" : "11px sans-serif";
        ctx.fillStyle = isHovered ? "#00FF9D" : "rgba(255, 255, 255, 0.85)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const titleStr =
          node.title.length > 20 ? node.title.substring(0, 18) + "…" : node.title;
        ctx.fillText(titleStr, node.x, node.y + node.radius + 6);
      }

      ctx.restore();
      stateRef.current.animId = requestAnimationFrame(render);
    };

    stateRef.current.animId = requestAnimationFrame(render);
  };

  // Convert mouse events to canvas local coordinates (accounting for pan & zoom)
  const getTransformedCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const width = containerRef.current.clientWidth || 800;
    const height = 540;
    const { zoom, pan } = stateRef.current;

    const x = (clientX - (width / 2 + pan.x)) / zoom + width / 2;
    const y = (clientY - (height / 2 + pan.y)) / zoom + height / 2;

    return { x, y, clientX, clientY };
  };

  const handleMouseDown = (e) => {
    const { x, y, clientX, clientY } = getTransformedCoords(e);
    const clickedNode = stateRef.current.nodes.find(
      (n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 6
    );

    stateRef.current.hasDragged = false;

    if (clickedNode) {
      stateRef.current.dragNode = clickedNode;
    } else {
      stateRef.current.isPanning = true;
      stateRef.current.startPan = {
        x: clientX - stateRef.current.pan.x,
        y: clientY - stateRef.current.pan.y,
      };
    }
  };

  const handleMouseMove = (e) => {
    const { x, y, clientX, clientY } = getTransformedCoords(e);

    if (stateRef.current.dragNode) {
      stateRef.current.hasDragged = true;
      stateRef.current.dragNode.x = x;
      stateRef.current.dragNode.y = y;
      stateRef.current.dragNode.vx = 0;
      stateRef.current.dragNode.vy = 0;
    } else if (stateRef.current.isPanning) {
      stateRef.current.hasDragged = true;
      stateRef.current.pan = {
        x: clientX - stateRef.current.startPan.x,
        y: clientY - stateRef.current.startPan.y,
      };
    } else {
      const found = stateRef.current.nodes.find(
        (n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 6
      );
      stateRef.current.hoveredNode = found || null;
      setActiveTooltip(found || null);
    }
  };

  const handleMouseUp = (e) => {
    const { x, y } = getTransformedCoords(e);
    if (!stateRef.current.hasDragged) {
      const clickedNode = stateRef.current.nodes.find(
        (n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 6
      );
      if (clickedNode) {
        navigate(`/note/${clickedNode.id}`);
      }
    }

    stateRef.current.dragNode = null;
    stateRef.current.isPanning = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    stateRef.current.zoom = Math.min(2.5, Math.max(0.4, stateRef.current.zoom * zoomFactor));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl bg-base-300/90 border border-primary/20 shadow-2xl overflow-hidden backdrop-blur-md"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-base-content/10 bg-base-200/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <NetworkIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              Semantic Knowledge Graph
              <span className="badge badge-primary badge-sm font-mono">{nodeCount} Notes</span>
            </h3>
            <p className="text-xs opacity-60">
              Interactive 2D galaxy connected by AI semantic similarity
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 bg-base-100 p-1 rounded-xl border border-base-content/10">
          <button
            type="button"
            onClick={() => {
              stateRef.current.zoom = Math.min(2.5, stateRef.current.zoom + 0.25);
            }}
            className="btn btn-ghost btn-xs btn-circle"
            title="Zoom In"
          >
            <ZoomInIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              stateRef.current.zoom = Math.max(0.4, stateRef.current.zoom - 0.25);
            }}
            className="btn btn-ghost btn-xs btn-circle"
            title="Zoom Out"
          >
            <ZoomOutIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              stateRef.current.zoom = 1;
              stateRef.current.pan = { x: 0, y: 0 };
            }}
            className="btn btn-ghost btn-xs btn-circle"
            title="Reset View"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={fetchGraphData}
            className="btn btn-ghost btn-xs btn-circle text-primary"
            title="Refresh Graph"
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative h-[540px] w-full bg-[#0a0e17] select-none cursor-grab active:cursor-grabbing">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-primary gap-2">
            <SparklesIcon className="size-8 animate-spin" />
            <span className="text-sm font-medium">Building semantic knowledge graph...</span>
          </div>
        ) : nodeCount === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-base-content/60">
            <NetworkIcon className="size-12 opacity-30 text-primary mb-2" />
            <p className="font-medium text-sm">No notes available yet</p>
            <p className="text-xs opacity-60">Create notes to visualize your knowledge graph!</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          />
        )}

        {/* Hover Tooltip */}
        {activeTooltip && (
          <div className="absolute bottom-4 left-4 max-w-sm p-4 rounded-xl bg-base-100/95 border border-primary/40 shadow-2xl backdrop-blur-md animate-fadeIn pointer-events-none">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-bold text-sm text-primary line-clamp-1">{activeTooltip.title}</h4>
              <span className="badge badge-xs badge-outline text-[10px]">Click to open</span>
            </div>
            <p className="text-xs text-base-content/80 line-clamp-2 leading-relaxed">
              {activeTooltip.preview}...
            </p>
          </div>
        )}

        {/* Graph Legend */}
        <div className="absolute top-4 right-4 bg-base-100/85 backdrop-blur-md p-3 rounded-xl border border-base-content/10 text-[11px] space-y-1 text-base-content/70 hidden sm:block pointer-events-none shadow-lg">
          <div className="flex items-center gap-1.5 font-semibold text-base-content mb-1">
            <SparklesIcon className="size-3 text-primary" />
            <span>Graph Interaction</span>
          </div>
          <p>• <span className="text-primary font-medium">Drag node</span> to arrange</p>
          <p>• <span className="text-primary font-medium">Drag background</span> to pan</p>
          <p>• <span className="text-primary font-medium">Scroll</span> to zoom in/out</p>
          <p>• <span className="text-primary font-medium">Click node</span> to open note</p>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
