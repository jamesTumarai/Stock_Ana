import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Error caught in ${this.props.name || 'component'}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 my-6 bg-stone-50 border border-stone-200 rounded-3xl text-stone-800 max-w-xl mx-auto shadow-sm flex flex-col gap-4 text-center items-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-stone-900 mb-1">
              เกิดข้อผิดพลาดในการแสดงผล {this.props.name ? `(${this.props.name})` : ''}
            </h3>
            <p className="text-xs text-stone-500 max-w-md">
              ระบบพบปัญหาชั่วคราวในการโหลดข้อมูลส่วนนี้ ท่านสามารถลองกดปุ่มด้านล่างเพื่อโหลดใหม่
            </p>
          </div>
          {this.state.error?.message && (
            <div className="w-full text-left font-mono text-[11px] bg-stone-100 text-stone-600 p-3 rounded-xl overflow-x-auto border border-stone-200">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0b5a4b] hover:bg-[#09473b] text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            ลองโหลดใหม่อีกครั้ง
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
