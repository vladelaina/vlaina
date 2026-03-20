export class RequestManager {
    private controllers = new Map<string, AbortController>();

    start(sessionId: string): AbortController {
        this.abort(sessionId);
        const controller = new AbortController();
        this.controllers.set(sessionId, controller);
        return controller;
    }

    abort(sessionId: string) {
        const controller = this.controllers.get(sessionId);
        if (controller) {
            controller.abort();
            this.controllers.delete(sessionId);
        }
    }

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

    isGenerating(sessionId: string): boolean {
        return this.controllers.has(sessionId);
    }
}

export const requestManager = new RequestManager();
