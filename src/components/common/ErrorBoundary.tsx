import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WindowControls } from '@/components/layout/WindowControls';
import { MacOSTrafficLightPreviewControls } from '@/components/layout/shell/UnifiedTitleBar';
import { writeTextToClipboard } from '@/lib/clipboard';
import { isMacOS, shouldRenderMacOSTrafficLightPreview } from '@/lib/desktop/platform';
import { getElectronBridge } from '@/lib/electron/bridge';
import { translate } from '@/lib/i18n';
import { useUIStore } from '@/stores/uiSlice';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
  copied: boolean;
  appVersion: string | null;
  logFilePath: string | null;
  logsDir: string | null;
  reportedAt: string | null;
}

const GITHUB_ISSUES_URL = 'https://github.com/vladelaina/vlaina/issues';

function ErrorWindowChrome() {
  const devPlatformPreview = useUIStore((state) => state.devPlatformPreview);
  const reserveMacTrafficLightSpace = isMacOS(devPlatformPreview);
  const showTrafficLightPreview = shouldRenderMacOSTrafficLightPreview(devPlatformPreview);

  return (
    <div className="app-drag-region app-title-bar flex h-10 shrink-0 select-none items-center bg-background/95">
      <div className="relative flex h-full flex-1 items-center">
        {showTrafficLightPreview ? <MacOSTrafficLightPreviewControls /> : null}
        <div className={reserveMacTrafficLightSpace ? 'w-[var(--vlaina-space-76px)]' : 'w-3'} />
      </div>
      <WindowControls className="z-[var(--vlaina-z-50)]" />
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    componentStack: '',
    copied: false,
    appVersion: null,
    logFilePath: null,
    logsDir: null,
    reportedAt: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      error,
      componentStack: '',
      copied: false,
      appVersion: null,
      logFilePath: null,
      logsDir: null,
      reportedAt: new Date().toISOString(),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[vlaina] React error boundary caught an error:', error, info);
    }

    const componentStack = info.componentStack ?? '';
    const reportedAt = new Date().toISOString();
    this.setState({ componentStack, reportedAt });

    const desktopApp = getElectronBridge()?.app;
    void Promise.all([
      desktopApp?.getVersion?.().catch(() => null) ?? Promise.resolve(null),
      desktopApp?.reportRendererError?.({
        source: 'react-error-boundary',
        type: 'react',
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack,
        error,
      }).catch(() => null) ?? Promise.resolve(null),
    ]).then(([appVersion, logInfo]) => {
      this.setState({
        appVersion,
        logFilePath: logInfo?.logFilePath ?? logInfo?.currentLogFilePath ?? null,
        logsDir: logInfo?.logsDir ?? null,
      });
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleDismiss = () => {
    this.setState({
      error: null,
      componentStack: '',
      copied: false,
      appVersion: null,
      logFilePath: null,
      logsDir: null,
      reportedAt: null,
    });
  };

  private buildErrorReport = () => {
    const { error, componentStack, appVersion, logFilePath, logsDir, reportedAt } = this.state;
    if (!error) return '';

    const lines = [
      'vlaina error report',
      `Time: ${reportedAt ?? new Date().toISOString()}`,
      `Version: ${appVersion ?? 'unknown'}`,
      `URL: ${window.location.href}`,
      `Log file: ${logFilePath ?? 'not available'}`,
      `Log folder: ${logsDir ?? 'not available'}`,
      `User agent: ${navigator.userAgent}`,
      `Language: ${navigator.language}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio}x`,
      `Online: ${navigator.onLine}`,
      '',
      `${error.name || 'Error'}: ${error.message || 'Unknown error'}`,
      '',
      'Stack:',
      error.stack || '(none)',
      '',
      'Component stack:',
      componentStack || '(none)',
    ];

    return lines.join('\n');
  };

  private handleCopyErrorReport = async () => {
    const copied = await writeTextToClipboard(this.buildErrorReport());
    if (!copied) return;

    this.setState({ copied: true });
    window.setTimeout(() => {
      this.setState({ copied: false });
    }, 1200);
  };

  private handleOpenLogFolder = () => {
    void getElectronBridge()?.app?.openErrorLogFolder?.();
  };

  private handleOpenGitHubIssues = () => {
    const shell = getElectronBridge()?.shell;
    if (shell?.openExternal) {
      void shell.openExternal(GITHUB_ISSUES_URL);
      return;
    }

    window.open(GITHUB_ISSUES_URL, '_blank', 'noopener,noreferrer');
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorReport = this.buildErrorReport();

      return (
        <div className="flex h-full min-h-screen w-full flex-col bg-background">
          <ErrorWindowChrome />
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-3xl space-y-4 text-left">
            <h2 className="text-lg font-semibold text-foreground">
              {translate('common.somethingWentWrong')}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {translate('common.errorReportInstruction')}
            </p>
            {this.state.logFilePath ? (
              <p className="break-all text-xs text-muted-foreground">
                {translate('common.logFile')}: {this.state.logFilePath}
              </p>
            ) : null}
            <div>
              <div className="mb-2 text-sm font-medium text-foreground">
                {translate('common.errorDetails')}
              </div>
              <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs leading-5 text-muted-foreground">
                {errorReport}
              </pre>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleCopyErrorReport}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {this.state.copied
                  ? translate('common.copied')
                  : translate('common.copyErrorReport')}
              </button>
              {getElectronBridge()?.app?.openErrorLogFolder ? (
                <button
                  type="button"
                  onClick={this.handleOpenLogFolder}
                  className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  {translate('common.openLogFolder')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={this.handleDismiss}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                {translate('common.tryAgain')}
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                {translate('common.reload')}
              </button>
            </div>
            <button
              type="button"
              onClick={this.handleOpenGitHubIssues}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {translate('common.reportOnGitHub')}
            </button>
          </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
