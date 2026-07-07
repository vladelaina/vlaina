import { useI18n } from '@/lib/i18n';
import { WhiteboardSurface } from './components/WhiteboardSurface';
import { WhiteboardToolbar } from './components/WhiteboardToolbar';
import { useWhiteboardController } from './hooks/useWhiteboardController';

interface WhiteboardViewProps {
  active?: boolean;
  onPrimaryContentReady?: () => void;
  onStartupReady?: () => void;
}

export function WhiteboardView({
  active = true,
  onPrimaryContentReady,
  onStartupReady,
}: WhiteboardViewProps) {
  const { t } = useI18n();
  const board = useWhiteboardController({ active, onPrimaryContentReady, onStartupReady });

  return (
    <section
      aria-label={t('app.viewWhiteboard')}
      data-whiteboard-active={active ? 'true' : 'false'}
      className="relative h-full min-h-0 overflow-hidden bg-[var(--vlaina-color-whiteboard-canvas)] text-[var(--vlaina-color-text-primary)]"
    >
      <WhiteboardSurface
        brushCursorColor={board.brushCursorColor}
        brushCursorPoint={board.brushCursorPoint}
        brushCursorSize={board.brushCursorSize}
        brushCursorTool={board.brushCursorTool}
        connectorSourceId={board.connectorSourceId}
        connectors={board.connectors}
        draftStroke={board.draftStroke}
        elementTextLabel={t('whiteboard.elementText')}
        elements={board.elements}
        isPanning={board.isPanning}
        resizeLabel={t('whiteboard.resizeElement')}
        ruler={board.ruler}
        rulerCloseLabel={t('common.close')}
        rulerRotateLabel={t('whiteboard.rotateRuler')}
        selectedElementIds={board.selectedElementIds}
        selectedStrokeIds={board.selectedStrokeIds}
        selectionRect={board.selectionRect}
        spacePressed={board.spacePressed}
        strokes={board.strokes}
        tool={board.tool}
        viewport={board.viewport}
        viewportRef={board.viewportRef}
        onConnectorTarget={board.handleConnectorTarget}
        onDoubleClick={board.handleSurfaceDoubleClick}
        onElementPointerDown={board.handleElementPointerDown}
        onElementTextChange={board.setElementText}
        onImageDrop={board.importImage}
        onPointerCancel={board.finishPointerAction}
        onPointerDown={board.handleViewportPointerDown}
        onPointerLeave={() => board.setBrushCursorPoint(null)}
        onPointerMove={board.handlePointerMove}
        onPointerUp={board.finishPointerAction}
        onResizePointerDown={board.handleResizePointerDown}
        onRulerClose={board.handleRulerClose}
        onRulerPointerDown={board.handleRulerPointerDown}
        onSelectElement={board.setSelectedElementId}
        onSelectionResizePointerDown={board.handleSelectionResizePointerDown}
        onWheel={board.handleWheel}
      />

      <WhiteboardToolbar
        brushColors={board.brushColors}
        brushSizes={board.brushSizes}
        canRedo={board.canRedo}
        canUndo={board.canUndo}
        tool={board.tool}
        viewport={board.viewport}
        onBrushColorChange={board.setBrushColor}
        onBrushSizeChange={board.resizeBrush}
        onClear={board.clearBoard}
        onCopy={board.onCopy}
        onDuplicate={board.onDuplicate}
        onExport={board.exportBoard}
        onFitView={board.fitView}
        onImageAdd={board.importImage}
        onPaste={board.onPaste}
        onRedo={board.handleRedo}
        onResetView={board.resetView}
        onToolChange={board.setTool}
        onUndo={board.handleUndo}
        onZoomChange={board.updateZoom}
      />
    </section>
  );
}
