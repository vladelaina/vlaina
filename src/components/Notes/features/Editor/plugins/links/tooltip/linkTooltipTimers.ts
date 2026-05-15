export class LinkTooltipTimers {
    private hideTimer: number | null = null;
    private showTimer: number | null = null;
    private focusTimer: number | null = null;
    private pendingRafs: Set<number> = new Set();

    scheduleShow(callback: () => void, delay: number) {
        this.clearShow();
        this.showTimer = window.setTimeout(callback, delay);
    }

    clearShow() {
        if (!this.showTimer) return;
        clearTimeout(this.showTimer);
        this.showTimer = null;
    }

    scheduleHide(callback: () => void, delay: number) {
        this.clearHide();
        this.hideTimer = window.setTimeout(callback, delay);
    }

    clearHide() {
        if (!this.hideTimer) return;
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
    }

    scheduleFocus(callback: () => void, delay: number) {
        this.clearFocus();
        this.focusTimer = window.setTimeout(callback, delay);
    }

    clearFocus() {
        if (!this.focusTimer) return;
        clearTimeout(this.focusTimer);
        this.focusTimer = null;
    }

    scheduleRaf(callback: () => void) {
        const id = requestAnimationFrame(() => {
            this.pendingRafs.delete(id);
            callback();
        });
        this.pendingRafs.add(id);
    }

    clearAll() {
        this.clearShow();
        this.clearHide();
        this.clearFocus();
        for (const id of this.pendingRafs) cancelAnimationFrame(id);
        this.pendingRafs.clear();
    }
}
