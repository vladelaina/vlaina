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

  return (
    <section
      aria-label={t('app.viewWhiteboard')}
      data-whiteboard-active={active ? 'true' : 'false'}
      className="relative h-full min-h-0 overflow-hidden bg-[var(--vlaina-bg-primary)] text-[var(--vlaina-color-text-primary)]"
    >
      <WhiteboardSurface
        brushCursorColor={board.brushCursorColor}
        brushCursorPoint={board.brushCursorPoint}
        brushCursorSize={board.brushCursorSize}
        brushCursorTool={board.brushCursorTool}
        draftStroke={board.draftStroke}
        elements={board.elements}
        eraserPreview={board.eraserPreview}
        isPanning={board.isPanning}
        movePreview={board.movePreview}
        paperStyle={board.paperStyle}
        resizeLabel={t('whiteboard.resizeElement')}
        ruler={board.ruler}
        rulerCloseLabel={t('common.close')}
        rulerRotateLabel={t('whiteboard.rotateRuler')}
        selectedElementIds={board.selectedElementIds}
        selectedStrokeIds={board.selectedStrokeIds}
        selectionPath={board.selectionPath}
        selectionRect={board.selectionRect}
        spacePressed={board.spacePressed}
        strokes={board.strokes}
        tool={board.tool}
        viewport={board.viewport}
        viewportRef={board.viewportRef}
        onElementPointerDown={board.handleElementPointerDown}
        onImageDrop={board.importImage}
        onPointerCancel={board.finishPointerAction}
        onPointerDown={board.handleViewportPointerDown}
        onPointerLeave={() => board.setBrushCursorPoint(null)}
        onPointerMove={board.handlePointerMove}
        onPointerUp={board.finishPointerAction}
        onResizePointerDown={board.handleResizePointerDown}
        onRulerClose={board.handleRulerClose}
        onRulerPointerDown={board.handleRulerPointerDown}
        onSelectionResizePointerDown={board.handleSelectionResizePointerDown}
        onWheel={board.handleWheel}
      />
      <WhiteboardMoreMenu
        paperStyle={board.paperStyle}
        onCopyImage={board.copyBoardToClipboard}
        onExport={board.exportBoard}
        onPaperStyleChange={board.setPaperStyle}
      />

      <WhiteboardToolbar
        active={active}
        brushColors={board.brushColors}
        brushSizes={board.brushSizes}
        tool={board.tool}
        viewport={board.viewport}
        onBrushColorChange={board.setBrushColor}
        onBrushSizeSelect={board.setBrushSize}
        onFitView={board.fitView}
        onImageAdd={board.importImage}
        onResetView={board.resetView}
        onToolChange={board.setTool}
        onZoomChange={board.updateZoom}
      />
    </section>
  );
}
