export class RequestManager {
    private controllers = new Map<string, AbortController>();

    /**
     * Start a request for a session. Aborts any existing request for THAT session.
     */
    start(sessionId: string): AbortController {
        this.abort(sessionId); // Auto-cancel previous request in SAME session
        const controller = new AbortController();
        this.controllers.set(sessionId, controller);
        return controller;
    }

    /**
     * Abort request for a specific session.
     */
    abort(sessionId: string) {
        const controller = this.controllers.get(sessionId);
        if (controller) {
            controller.abort();
            this.controllers.delete(sessionId);
        }
    }

    /**
     * Mark a session as finished (remove controller without aborting).
     */
    finish(sessionId: string, controller?: AbortController) {
        if (!controller) {
            this.controllers.delete(sessionId);
            return;
        }
        const current = this.controllers.get(sessionId);
        if (current === controller) {
            this.controllers.delete(sessionId);
        }
    }

    /**
     * Check if a session is generating.
     */
    isGenerating(sessionId: string): boolean {
        return this.controllers.has(sessionId);
    }
}

export const requestManager = new RequestManager();
