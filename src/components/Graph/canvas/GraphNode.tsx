import { memo, type CSSProperties, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { themeGraphTokens } from '@/styles/themeTokens';
import type { PositionedGraphNode } from '../model/graphLayout';
import type { GraphNodePosition } from '../store/useGraphUIStore';

export const GraphNode = memo(function GraphNode(props: {
  dragging: boolean;
  hovered: boolean;
  node: PositionedGraphNode;
  onHoverChange: (path: string | null) => void;
  onFocusChange: (path: string) => void;
  onOpen: (path: string) => void;
  onPositionCommit: (path: string, position: GraphNodePosition) => void;
  onSelect: (path: string) => void;
  onStartDrag: (event: PointerEvent<SVGGElement>, path: string, position: GraphNodePosition) => void;
  related: boolean;
  selected: boolean;
  dimmed: boolean;
  showLabel: boolean;
}) {
  const { node } = props;
  const nodeRadius = themeGraphTokens.nodeRadiusPx + Math.min(
    themeGraphTokens.nodeDegreeRadiusMaxBonusPx,
    Math.sqrt(node.degree) * themeGraphTokens.nodeDegreeRadiusScalePx,
  );
  return (
    <g
      data-graph-node-position={node.id}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${node.label}, ${node.degree}`}
      className={cn('cursor-grab outline-none', props.dragging && 'cursor-grabbing')}
      onPointerDown={(event) => props.onStartDrag(event, node.id, { x: node.x, y: node.y })}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); props.onOpen(node.id); return; }
        if (event.key === ' ') { event.preventDefault(); props.onSelect(node.id); return; }
        const step = event.shiftKey ? 12 : 2;
        const delta = event.key === 'ArrowLeft' ? { x: -step, y: 0 }
          : event.key === 'ArrowRight' ? { x: step, y: 0 }
            : event.key === 'ArrowUp' ? { x: 0, y: -step }
              : event.key === 'ArrowDown' ? { x: 0, y: step } : null;
        if (!delta) return;
        event.preventDefault();
        props.onSelect(node.id);
        props.onPositionCommit(node.id, { x: node.x + delta.x, y: node.y + delta.y });
      }}
      onMouseEnter={() => props.onHoverChange(node.id)}
      onMouseLeave={() => props.onHoverChange(null)}
      onFocus={() => props.onFocusChange(node.id)}
      onBlur={() => props.onHoverChange(null)}
    >
      <circle
        data-graph-node-hit-target={node.id}
        cx={0}
        cy={0}
        r={themeGraphTokens.nodeHitRadiusPx}
        style={{
          r: `calc(${themeGraphTokens.nodeHitRadiusPx}px * var(--vlaina-graph-inverse-zoom))`,
        } as CSSProperties}
        className="fill-transparent"
        pointerEvents="all"
      />
      <circle
        cx={0}
        cy={0}
        r={nodeRadius}
        style={{
          r: `calc(${nodeRadius}px * var(--vlaina-graph-inverse-zoom))`,
          transform: props.selected || props.hovered
            ? themeGraphTokens.nodeActiveTransform
            : themeGraphTokens.nodeDefaultTransform,
          opacity: props.dimmed ? themeGraphTokens.dimmedNodeOpacity : 1,
        } as CSSProperties}
        className={cn(
          'vlaina-graph-node-dot',
          props.selected || props.hovered
            ? 'fill-[var(--vlaina-color-graph-node-active)] stroke-[var(--vlaina-color-graph-node-ring-active)]'
            : props.related
              ? 'fill-[var(--vlaina-color-graph-node-related)] stroke-[var(--vlaina-color-graph-node-ring)]'
              : 'fill-[var(--vlaina-color-graph-node)] stroke-[var(--vlaina-color-graph-node-ring)]',
        )}
        strokeWidth={themeGraphTokens.nodeRingWidthPx}
        vectorEffect="non-scaling-stroke"
      />
      {props.showLabel || props.selected || props.hovered || props.related ? (
        <g
          data-graph-node-label="true"
          className="vlaina-graph-label-enter pointer-events-none"
        >
          <g style={{
            opacity: props.dimmed ? themeGraphTokens.dimmedNodeOpacity : 1,
            transform: themeGraphTokens.inverseZoomTransform,
          }}>
            <text
              x={0}
              y={themeGraphTokens.labelOffsetYPx}
              textAnchor="middle"
              className="fill-[var(--vlaina-color-graph-label)] font-medium"
              fontSize="var(--vlaina-font-13)"
            >
              {node.label}
            </text>
          </g>
        </g>
      ) : null}
    </g>
  );
});
