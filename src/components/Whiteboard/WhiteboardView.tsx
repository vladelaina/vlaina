import { useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { WhiteboardSurface } from './components/WhiteboardSurface';
import { WhiteboardMoreMenu } from './components/WhiteboardMoreMenu';
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
  const exportPng = useCallback(() => board.exportBoard('png'), [board.exportBoard]);

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
        draftElement={board.draftElement}
        draftStroke={board.draftStroke}
        elementTextLabel={t('whiteboard.elementText')}
        elements={board.elements}
        isPanning={board.isPanning}
        movePreview={board.movePreview}
        paperStyle={board.paperStyle}
        resizeLabel={t('whiteboard.resizeElement')}
        ruler={board.ruler}
        rulerCloseLabel={t('common.close')}
        rulerRotateLabel={t('whiteboard.rotateRuler')}
        selectedConnectorIds={board.selectedConnectorIds}
        selectedElementIds={board.selectedElementIds}
        selectedStrokeIds={board.selectedStrokeIds}
        selectionPath={board.selectionPath}
        selectionRect={board.selectionRect}
        spacePressed={board.spacePressed}
        strokes={board.strokes}
        tool={board.tool}
        viewport={board.viewport}
        viewportRef={board.viewportRef}
        onConnectorTarget={board.handleConnectorTarget}
        onSelectConnector={board.selectConnector}
        onDoubleClick={board.handleSurfaceDoubleClick}
        onElementPointerDown={board.handleElementPointerDown}
        onElementTextEditEnd={board.endElementTextEdit}
        onElementTextEditStart={board.beginElementTextEdit}
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

      {board.persistenceStatus && !board.persistenceStatus.ok ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute right-3 top-14 z-[var(--vlaina-z-20)] rounded-[var(--vlaina-radius-pill)] border border-[var(--vlaina-color-status-danger-border)] bg-[var(--vlaina-color-status-danger-bg)] px-3 py-1.5 text-[var(--vlaina-font-125)] font-medium text-[var(--vlaina-color-status-danger-fg)] shadow-[var(--vlaina-shadow-toolbar)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)]"
        >
          {t('app.closeSaveFailedTitle')}
        </div>
      ) : null}

      <WhiteboardMoreMenu
        paperStyle={board.paperStyle}
        onCopyImage={board.copyBoardToClipboard}
        onExport={board.exportBoard}
        onPaperStyleChange={board.setPaperStyle}
      />

      <WhiteboardToolbar
        brushColors={board.brushColors}
        brushSizes={board.brushSizes}
        canRedo={board.canRedo}
        canUndo={board.canUndo}
        selectedNoteColor={board.selectedNoteColor}
        tool={board.tool}
        viewport={board.viewport}
        onBrushColorChange={board.setBrushColor}
        onBrushSizeChange={board.resizeBrush}
        onClear={board.clearBoard}
        onCopy={board.onCopy}
        onDuplicate={board.onDuplicate}
        onExport={exportPng}
        onFitView={board.fitView}
        onImageAdd={board.importImage}
        onPaste={board.onPaste}
        onRedo={board.handleRedo}
        onResetView={board.resetView}
        onToolChange={board.setTool}
        onNoteColorChange={board.setSelectedNoteColor}
        onUndo={board.handleUndo}
        onZoomChange={board.updateZoom}
      />
    </section>
  );
}
