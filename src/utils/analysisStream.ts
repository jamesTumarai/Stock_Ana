/** Decode transport frames only. Financial validation stays at the report boundary. */
export class AnalysisStreamDecoder {
  private decoder = new TextDecoder();
  private buffer = '';

  push(bytes: Uint8Array): Record<string, any>[] {
    this.buffer += this.decoder.decode(bytes, { stream: true });
    return this.drain(false);
  }

  finish(): Record<string, any>[] {
    this.buffer += this.decoder.decode();
    return this.drain(true);
  }

  private drain(final: boolean): Record<string, any>[] {
    const frames = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = final ? '' : frames.pop() || '';
    const events: Record<string, any>[] = [];
    for (const frame of frames) {
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, '')).join('\n');
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event && typeof event === 'object' && !Array.isArray(event)) events.push(event);
      } catch { /* An incomplete/malformed frame is not a report. */ }
    }
    return events;
  }
}
