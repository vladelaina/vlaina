/**
 * GraphView - Visual graph of note connections
 * 
 * Obsidian-style graph view showing links between notes
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { XIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, CrosshairIcon } from '@phosphor-icons/react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  name: string;
  path: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  links: string[];
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphViewProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeClick: (path: string) => void;
  currentNotePath?: string;
}



export function GraphView({ isOpen, onClose, onNodeClick, currentNotePath }: GraphViewProps) {
  const { rootFolder, noteContentsCache, scanAllNotes } = useNotesStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  // Scan notes when graph opens if cache is empty
  useEffect(() => {
    if (isOpen && noteContentsCache.size === 0) {
      scanAllNotes();
    }
  }, [isOpen, noteContentsCache.size, scanAllNotes]);

  // Extract wiki links from content
  const extractWikiLinks = (content: string): string[] => {
    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1].toLowerCase());
    }
    return [...new Set(links)];
  };

  // Build graph data from file tree and note contents
  const { nodes, links } = useMemo(() => {
    if (!rootFolder) return { nodes: [], links: [] };

    const nodeMap = new Map<string, GraphNode>();
    const linkList: GraphLink[] = [];

    // Collect all notes
    const collectNotes = (items: FileTreeNode[]) => {
      for (const item of items) {
        if (item.isFolder) {
          collectNotes(item.children);
        } else {
          const noteId = item.name.replace('.md', '').toLowerCase();
          const content = noteContentsCache.get(item.path) || '';
          const wikiLinks = extractWikiLinks(content);
          
          const node: GraphNode = {
            id: noteId,
            name: item.name.replace('.md', ''),
            path: item.path,
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
            vx: 0,
            vy: 0,
            links: wikiLinks,
          };
          nodeMap.set(noteId, node);
        }
      }
    };

    collectNotes(rootFolder.children);

    // Build links from wiki links
    nodeMap.forEach((node) => {
      for (const linkTarget of node.links) {
        if (nodeMap.has(linkTarget)) {
          linkList.push({
            source: node.id,
            target: linkTarget,
          });
        }
      }
    });

    const nodeArray = Array.from(nodeMap.values());
    
    return { nodes: nodeArray, links: linkList };
  }, [rootFolder, noteContentsCache]);

  // Force-directed layout simulation
  useEffect(() => {
    if (!isOpen || nodes.length === 0) return;

    nodesRef.current = nodes.map(n => ({ ...n }));
    
    const simulate = () => {
      const nodesCopy = nodesRef.current;
      
      // Apply forces
      for (let i = 0; i < nodesCopy.length; i++) {
        const node = nodesCopy[i];
        
        // Repulsion from other nodes
        for (let j = 0; j < nodesCopy.length; j++) {
          if (i === j) continue;
          const other = nodesCopy[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1000 / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
        
        // Center gravity
        node.vx -= node.x * 0.01;
        node.vy -= node.y * 0.01;
        
        // Damping
        node.vx *= 0.9;
        node.vy *= 0.9;
        
        // Update position
        node.x += node.vx;
        node.y += node.vy;
      }
      
      // Draw
      draw();
      
      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, nodes]);

  // Draw the graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2 + offset.x;
    const centerY = height / 2 + offset.y;

    // Clear
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // Draw links
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    for (const link of links) {
      const source = nodesRef.current.find(n => n.id === link.source);
      const target = nodesRef.current.find(n => n.id === link.target);
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(centerX + source.x * zoom, centerY + source.y * zoom);
        ctx.lineTo(centerX + target.x * zoom, centerY + target.y * zoom);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      const x = centerX + node.x * zoom;
      const y = centerY + node.y * zoom;
      const radius = node.path === currentNotePath ? 8 : 5;
      
      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius * zoom, 0, Math.PI * 2);
      
      if (node.path === currentNotePath) {
        ctx.fillStyle = '#a855f7';
      } else if (node.id === hoveredNode) {
        ctx.fillStyle = '#8b5cf6';
      } else {
        ctx.fillStyle = '#6366f1';
      }
      ctx.fill();

      // Node label
      if (zoom > 0.5 || node.path === currentNotePath || node.id === hoveredNode) {
        ctx.fillStyle = '#a1a1aa';
        ctx.font = `${11 * zoom}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(node.name, x, y + (radius + 12) * zoom);
      }
    }
  }, [zoom, offset, links, currentNotePath, hoveredNode]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Check for node hover
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2 - offset.x;
    const mouseY = e.clientY - rect.top - canvas.height / 2 - offset.y;

    let found = false;
    for (const node of nodesRef.current) {
      const dx = mouseX / zoom - node.x;
      const dy = mouseY / zoom - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        setHoveredNode(node.id);
        found = true;
        break;
      }
    }
    if (!found) setHoveredNode(null);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (_e: React.MouseEvent) => {
    if (hoveredNode) {
      const node = nodesRef.current.find(n => n.id === hoveredNode);
      if (node) {
        onNodeClick(node.path);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-100">Graph View</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.min(3, z * 1.2))}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Zoom In"
          >
            <MagnifyingGlassPlusIcon className="size-5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Zoom Out"
          >
            <MagnifyingGlassMinusIcon className="size-5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Reset View"
          >
            <CrosshairIcon className="size-5" />
          </button>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <XIcon className="size-5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className={cn(
          "cursor-grab",
          isDragging && "cursor-grabbing",
          hoveredNode && "cursor-pointer"
        )}
      />

      {/* Stats */}
      <div className="absolute bottom-4 left-4 px-3 py-2 bg-zinc-900/80 backdrop-blur rounded-lg border border-zinc-800">
        <p className="text-xs text-zinc-400">
          {nodes.length} notes • {links.length} links
        </p>
      </div>
    </div>
  );
}
