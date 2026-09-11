export interface LatencyBreakdown {
  stages: Record<string, number>;
  totalMs: number;
  startedAt: string;
  completedAt: string | null;
}

export interface LatencyTrackerOptions {
  now?: () => number;
}

/**
 * Institutional stage-level latency tracker for end-to-end analysis telemetry.
 * Measures timing across SEC retrieval, market snapshot, AI model streaming,
 * assumption bridge, and schema validation.
 */
export class LatencyTracker {
  private readonly now: () => number;
  private readonly startTime: number;
  private readonly startedAtIso: string;
  private readonly stageTimings = new Map<string, number>();
  private activeStages = new Map<string, number>();

  constructor(options: LatencyTrackerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.startTime = this.now();
    this.startedAtIso = new Date(this.startTime).toISOString();
  }

  startStage(stageName: string): () => number {
    const start = this.now();
    this.activeStages.set(stageName, start);

    return () => {
      const elapsed = Math.max(0, this.now() - start);
      this.stageTimings.set(stageName, (this.stageTimings.get(stageName) ?? 0) + elapsed);
      this.activeStages.delete(stageName);
      return elapsed;
    };
  }

  recordStage(stageName: string, durationMs: number): void {
    const sanitized = Math.max(0, Math.round(durationMs));
    this.stageTimings.set(stageName, (this.stageTimings.get(stageName) ?? 0) + sanitized);
  }

  getTimingBreakdown(): LatencyBreakdown {
    const totalMs = Math.max(0, this.now() - this.startTime);
    const stages: Record<string, number> = {};
    for (const [stage, duration] of this.stageTimings.entries()) {
      stages[stage] = duration;
    }

    return {
      stages,
      totalMs,
      startedAt: this.startedAtIso,
      completedAt: new Date(this.now()).toISOString(),
    };
  }

  formatSummary(): string {
    const breakdown = this.getTimingBreakdown();
    const stageEntries = Object.entries(breakdown.stages)
      .map(([k, v]) => `${k}: ${v}ms`)
      .join(', ');
    return `Total: ${(breakdown.totalMs / 1000).toFixed(2)}s [${stageEntries || 'no stage data'}]`;
  }
}
