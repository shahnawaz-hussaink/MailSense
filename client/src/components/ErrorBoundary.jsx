import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[MailSense] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-500/10 border border-red-500/25 rounded-xl p-6 text-center space-y-4">
            <div className="text-3xl">⚠️</div>
            <h1 className="text-lg font-semibold text-red-300">Something went wrong</h1>
            <p className="text-sm text-red-400/80 font-mono break-all">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20
                         hover:bg-red-600/30 text-red-300 text-sm border border-red-600/30
                         transition-colors cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
