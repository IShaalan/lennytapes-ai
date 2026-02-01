"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface GraphNode {
  id: string;
  type: "guest" | "topic" | "framework" | "company";
  label: string;
  size: number;
  metadata?: Record<string, unknown>;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  relationship: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    displayedNodes: number;
    displayedEdges: number;
  };
}

const NODE_COLORS: Record<string, string> = {
  guest: "#FF6B2C",
  framework: "#00B4A0",
  company: "#6C63FF",
  topic: "#8B5CF6",
};

export default function GraphPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());
  const alphaRef = useRef(1);
  const animationRef = useRef<number>();
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Fetch data
  useEffect(() => {
    async function fetchGraph() {
      try {
        const response = await fetch("/api/graph");
        if (!response.ok) throw new Error("Failed to load graph");
        const result = await response.json();
        setData(result);

        // Initialize positions in a circle by type
        const width = 1000;
        const height = 600;
        const centerX = width / 2;
        const centerY = height / 2;

        // Group by type for better initial layout
        const byType: Record<string, typeof result.nodes> = {};
        for (const node of result.nodes) {
          if (!byType[node.type]) byType[node.type] = [];
          byType[node.type].push(node);
        }

        const typeAngles: Record<string, number> = {
          guest: 0,
          framework: Math.PI / 2,
          company: Math.PI,
          topic: (3 * Math.PI) / 2,
        };

        const initialized: GraphNode[] = [];
        for (const [type, nodes] of Object.entries(byType)) {
          const baseAngle = typeAngles[type] || 0;
          const radius = type === "guest" ? 150 : 280;
          nodes.forEach((n: GraphNode, i: number) => {
            const angle = baseAngle + (i / nodes.length) * (Math.PI / 2) - Math.PI / 4;
            initialized.push({
              ...n,
              x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
              y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
              vx: 0,
              vy: 0,
            });
          });
        }

        nodesRef.current = initialized;
        edgesRef.current = result.edges;
        nodeMapRef.current = new Map(initialized.map(n => [n.id, n]));
        alphaRef.current = 1;

      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x: tx, y: ty, scale } = transform;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(tx + canvas.width / 2, ty + canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Draw edges
    for (const edge of edgesRef.current) {
      const source = nodeMapRef.current.get(edge.source);
      const target = nodeMapRef.current.get(edge.target);
      if (!source || !target) continue;

      const isHighlighted =
        selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = isHighlighted ? "#FF6B2C" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = isHighlighted ? 2 : Math.min(edge.weight, 3) * 0.5;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      const radius = Math.sqrt(node.size) * 3 + 6;
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isConnected = selectedNode && edgesRef.current.some(
        e => (e.source === selectedNode.id && e.target === node.id) ||
             (e.target === selectedNode.id && e.source === node.id)
      );

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = NODE_COLORS[node.type] || "#888";
      ctx.globalAlpha = (isSelected || isHovered || isConnected || !selectedNode) ? 1 : 0.3;
      ctx.fill();

      // Border for selected/hovered
      if (isSelected || isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      if (node.type === "guest" || isHovered || isSelected || node.size > 5) {
        ctx.globalAlpha = (isSelected || isHovered || isConnected || !selectedNode) ? 1 : 0.3;
        ctx.fillStyle = "#fff";
        ctx.font = `${isSelected || isHovered ? "bold " : ""}${node.type === "guest" ? 11 : 9}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Truncate long labels
        let label = node.label;
        if (label.length > 20 && !isHovered && !isSelected) {
          label = label.slice(0, 18) + "...";
        }
        ctx.fillText(label, node.x, node.y + radius + 4);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [transform, selectedNode, hoveredNode]);

  // Simulation
  useEffect(() => {
    if (!data) return;

    function simulate() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap = nodeMapRef.current;

      // Decay alpha
      alphaRef.current *= 0.99;
      const alpha = alphaRef.current;

      if (alpha > 0.001) {
        // Center gravity
        const centerX = 500;
        const centerY = 300;

        for (const node of nodes) {
          node.vx *= 0.85;
          node.vy *= 0.85;
          node.vx += (centerX - node.x) * 0.0003 * alpha;
          node.vy += (centerY - node.y) * 0.0003 * alpha;
        }

        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = 60;
            if (dist < minDist * 3) {
              const force = ((minDist * minDist) / (dist * dist)) * alpha * 0.5;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              nodes[i].vx -= fx;
              nodes[i].vy -= fy;
              nodes[j].vx += fx;
              nodes[j].vy += fy;
            }
          }
        }

        // Attraction along edges
        for (const edge of edges) {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) continue;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const idealDist = 120;
          const force = (dist - idealDist) * 0.003 * alpha;

          source.vx += (dx / dist) * force;
          source.vy += (dy / dist) * force;
          target.vx -= (dx / dist) * force;
          target.vy -= (dy / dist) * force;
        }

        // Update positions
        for (const node of nodes) {
          node.x += node.vx;
          node.y += node.vy;
          node.x = Math.max(50, Math.min(950, node.x));
          node.y = Math.max(50, Math.min(550, node.y));
        }
      }

      draw();
      animationRef.current = requestAnimationFrame(simulate);
    }

    simulate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [data, draw]);

  // Get node at position
  const getNodeAt = useCallback((clientX: number, clientY: number): GraphNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const { x: tx, y: ty, scale } = transform;

    // Convert screen coords to canvas coords
    const canvasX = ((clientX - rect.left - tx - canvas.width / 2) / scale) + canvas.width / 2;
    const canvasY = ((clientY - rect.top - ty - canvas.height / 2) / scale) + canvas.height / 2;

    for (const node of nodesRef.current) {
      const radius = Math.sqrt(node.size) * 3 + 6;
      const dx = canvasX - node.x;
      const dy = canvasY - node.y;
      if (dx * dx + dy * dy < radius * radius * 1.5) {
        return node;
      }
    }
    return null;
  }, [transform]);

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else {
      const node = getNodeAt(e.clientX, e.clientY);
      setHoveredNode(node);
    }
  }, [getNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) {
      setSelectedNode(prev => prev?.id === node.id ? null : node);
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(3, t.scale * delta)) }));
  }, []);

  const handleNodeClick = useCallback(() => {
    if (selectedNode?.type === "guest" && selectedNode.metadata?.slug) {
      router.push(`/guest/${selectedNode.metadata.slug}`);
    }
  }, [selectedNode, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="tape-spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-foreground-muted">Building knowledge graph...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">Failed to load graph</p>
          <p className="text-foreground-muted text-sm">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#0a0a0f]/90 backdrop-blur-sm border-b border-white/10 z-10 flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-[#6C63FF]" />
              <h1 className="font-bold text-white">Knowledge Graph</h1>
            </div>
            {data && (
              <span className="text-white/40 text-sm">
                {data.stats.displayedNodes} nodes · {data.stats.displayedEdges} connections
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTransform(t => ({ ...t, scale: Math.min(3, t.scale * 1.2) }))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-white/60" />
            </button>
            <button
              onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.3, t.scale * 0.8) }))}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-white/60" />
            </button>
            <button
              onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ background: "#0a0a0f" }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg p-3">
          <p className="text-white/40 text-xs mb-2 font-medium">Node Types</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-white/60 text-xs capitalize">{type}</span>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-2">Click node to select · Drag to pan · Scroll to zoom</p>
        </div>

        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-4 w-72">
            <div className="flex items-start justify-between mb-3">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                style={{
                  backgroundColor: NODE_COLORS[selectedNode.type] + "30",
                  color: NODE_COLORS[selectedNode.type],
                }}
              >
                {selectedNode.type}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-white/40 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>

            <h3 className="font-bold text-white mb-1">{selectedNode.label}</h3>
            <p className="text-white/40 text-sm mb-3">{selectedNode.size} mentions</p>

            {selectedNode.type === "guest" && selectedNode.metadata?.slug ? (
              <button
                onClick={handleNodeClick}
                className="w-full py-2 bg-[#FF6B2C] hover:bg-[#FF6B2C]/90 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Guest Profile →
              </button>
            ) : null}

            {selectedNode.type === "framework" && selectedNode.metadata?.description ? (
              <p className="text-white/60 text-sm">
                {String(selectedNode.metadata.description)}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
