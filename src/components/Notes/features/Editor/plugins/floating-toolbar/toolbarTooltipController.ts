import { themeDomStyleTokens, themeRenderingTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';
import { escapeToolbarHtml } from './htmlEscape';

export class ToolbarTooltipController {
  private tooltipElement: HTMLElement | null = null;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  schedule(button: HTMLElement) {
    if (!button.dataset.shortcut) {
      return;
    }

    this.hide();
    this.tooltipTimer = setTimeout(
      () => this.show(button),
      themeUiFeedbackTokens.toolbarTooltipDelayMs
    );
  }

  hide() {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }

    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible');
    }
  }

  destroy() {
    this.hide();

    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  private getElement() {
    if (!this.tooltipElement) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className = 'toolbar-tooltip';
      document.body.appendChild(this.tooltipElement);
    }
    return this.tooltipElement;
  }

  private show(button: HTMLElement) {
    const shortcut = button.dataset.shortcut;
    if (!shortcut) {
      return;
    }

    const tooltip = this.getElement();
    const keys = shortcut.split('+').map((key) => `<kbd>${escapeToolbarHtml(key)}</kbd>`).join('');
    tooltip.innerHTML = `
      <span class="toolbar-tooltip-shortcut">${keys}</span>
      <span class="toolbar-tooltip-arrow" aria-hidden="true"></span>
    `;
    tooltip.dataset.side = 'bottom';

    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + themeDomStyleTokens.toolbarTooltipOffsetPx}px`;
    tooltip.style.transform = themeRenderingTokens.translateCenterTop;
    tooltip.classList.add('visible');
  }
}
