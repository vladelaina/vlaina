import { Component, version as reactVersion, type ErrorInfo, type ReactNode } from 'react';
import { writeTextToClipboard } from '@/lib/clipboard';
import { getElectronBridge } from '@/lib/electron/bridge';
import { translate, type MessageKey } from '@/lib/i18n';

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
const FALLBACK_MESSAGES = {
  'common.somethingWentWrong': 'Something went wrong',
  'common.errorReportInstruction': 'Please copy this error report and contact the developer as soon as possible. A diagnostic log was also saved in the system configuration folder.',
  'common.logFile': 'Log file',
  'common.errorDetails': 'Error details',
  'common.copied': 'Copied',
  'common.copyErrorReport': 'Copy error report',
  'common.openLogFolder': 'Open log folder',
  'common.tryAgain': 'Try again',
  'common.reload': 'Reload',
  'common.reportOnGitHub': 'Open GitHub Issues',
} satisfies Partial<Record<MessageKey, string>>;

function isNativeMacOS() {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  );
}

function shouldPreviewMacOSChrome() {
  return (
    import.meta.env.DEV &&
    !isNativeMacOS() &&
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-vlaina-dev-platform-preview') === 'macos'
  );
}

function safeTranslate(key: keyof typeof FALLBACK_MESSAGES) {
  try {
    return translate(key);
  } catch {
    return FALLBACK_MESSAGES[key];
  }
}

function ErrorWindowButton({
  children,
  className = '',
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`app-no-drag flex h-10 w-12 items-center justify-center text-sm text-foreground/75 transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      {children}
    </button>
  );
}

function ErrorMacOSTrafficLightControls() {
  const buttonClass =
    'app-no-drag h-3 w-3 rounded-full border border-black/15 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-accent-focus-ring)]';

  return (
    <div className="absolute left-3 top-0 z-[var(--vlaina-z-60)] flex h-10 items-center gap-2">
      <button
        type="button"
        aria-label="Close window"
        onClick={() => void getElectronBridge()?.window?.close?.()}
        className={`${buttonClass} bg-[#ff5f57]`}
      />
      <button
        type="button"
        aria-label="Minimize window"
        onClick={() => void getElectronBridge()?.window?.minimize?.()}
        className={`${buttonClass} bg-[#febc2e]`}
      />
      <button
        type="button"
        aria-label="Maximize window"
        onClick={() => void getElectronBridge()?.window?.toggleMaximize?.()}
        className={`${buttonClass} bg-[#28c840]`}
      />
    </div>
  );
}

function ErrorWindowChrome() {
  const nativeMacOS = isNativeMacOS();
  const showMacOSPreview = shouldPreviewMacOSChrome();
  const useMacOSLayout = nativeMacOS || showMacOSPreview;

  return (
    <div className="app-drag-region app-title-bar relative flex h-10 shrink-0 select-none items-center bg-background/95">
      {showMacOSPreview ? <ErrorMacOSTrafficLightControls /> : null}
      <div className={useMacOSLayout ? 'w-[var(--vlaina-space-76px)]' : 'w-3'} />
      <div className="min-w-0 flex-1" />
      {!useMacOSLayout ? (
        <div className="app-no-drag flex shrink-0">
          <ErrorWindowButton
            label="Minimize window"
            onClick={() => void getElectronBridge()?.window?.minimize?.()}
          >
            -
          </ErrorWindowButton>
          <ErrorWindowButton
            label="Maximize window"
            onClick={() => void getElectronBridge()?.window?.toggleMaximize?.()}
          >
            □
          </ErrorWindowButton>
          <ErrorWindowButton
            label="Close window"
            onClick={() => void getElectronBridge()?.window?.close?.()}
            className="hover:bg-[var(--vlaina-color-danger)] hover:text-[var(--vlaina-color-white)]"
          >
            ×
          </ErrorWindowButton>
        </div>
      ) : null}
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
        reactVersion,
        buildMode: import.meta.env.MODE,
        isDev: import.meta.env.DEV,
        isProd: import.meta.env.PROD,
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
      `React: ${reactVersion}`,
      `Build: mode=${import.meta.env.MODE} dev=${String(import.meta.env.DEV)} prod=${String(import.meta.env.PROD)}`,
      `URL: ${window.location.href}`,
      `Log file: ${logFilePath ?? 'not available'}`,
      `Log folder: ${logsDir ?? 'not available'}`,
      `User agent: ${navigator.userAgent}`,
      `Language: ${navigator.language}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio}x`,
      `Online: ${navigator.onLine}`,
      `Document: visibility=${document.visibilityState} focus=${String(document.hasFocus())}`,
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
    void getElectronBridge()?.app?.openErrorLogFolder?.().catch(() => undefined);
  };

  private handleOpenGitHubIssues = () => {
    const shell = getElectronBridge()?.shell;
    if (shell?.openExternal) {
      void shell.openExternal(GITHUB_ISSUES_URL).catch(() => undefined);
      return;
    }

    try {
      window.open(GITHUB_ISSUES_URL, '_blank', 'noopener,noreferrer');
    } catch {
    }
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
                {safeTranslate('common.somethingWentWrong')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {safeTranslate('common.errorReportInstruction')}
              </p>
              {this.state.logFilePath ? (
                <p className="break-all text-xs text-muted-foreground">
                  {safeTranslate('common.logFile')}: {this.state.logFilePath}
                </p>
              ) : null}
              <div>
                <div className="mb-2 text-sm font-medium text-foreground">
                  {safeTranslate('common.errorDetails')}
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
                    ? safeTranslate('common.copied')
                    : safeTranslate('common.copyErrorReport')}
                </button>
                {getElectronBridge()?.app?.openErrorLogFolder ? (
                  <button
                    type="button"
                    onClick={this.handleOpenLogFolder}
                    className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    {safeTranslate('common.openLogFolder')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={this.handleDismiss}
                  className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  {safeTranslate('common.tryAgain')}
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  {safeTranslate('common.reload')}
                </button>
              </div>
              <button
                type="button"
                onClick={this.handleOpenGitHubIssues}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {safeTranslate('common.reportOnGitHub')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
