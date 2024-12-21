export interface WheelTimer {
  id: string;
  rounds: number;
  slot: number;
  callback: () => void;
}

export class TimerWheel {
  private wheelSize: number;
  private tickDurationMs: number;
  private slots: Map<number, WheelTimer[]> = new Map();
  private currentSlot: number = 0;

  constructor(wheelSize: number = 60, tickDurationMs: number = 1000) {
    this.wheelSize = wheelSize;
    this.tickDurationMs = tickDurationMs;
    for (let i = 0; i < wheelSize; i++) {
      this.slots.set(i, []);
    }
  }

  schedule(id: string, delayMs: number, callback: () => void): WheelTimer {
    const ticks = Math.max(1, Math.floor(delayMs / this.tickDurationMs));
    const rounds = Math.floor(ticks / this.wheelSize);
    const targetSlot = (this.currentSlot + ticks) % this.wheelSize;

    const timer: WheelTimer = { id, rounds, slot: targetSlot, callback };
    this.slots.get(targetSlot)!.push(timer);
    return timer;
  }

  advance(): string[] {
    const currentTimers = this.slots.get(this.currentSlot)!;
    const remaining: WheelTimer[] = [];
    const firedIds: string[] = [];

    for (const timer of currentTimers) {
      if (timer.rounds <= 0) {
        firedIds.push(timer.id);
        timer.callback();
      } else {
        timer.rounds--;
        remaining.push(timer);
      }
    }

    this.slots.set(this.currentSlot, remaining);
    this.currentSlot = (this.currentSlot + 1) % this.wheelSize;
    return firedIds;
  }

  getCurrentSlot(): number {
    return this.currentSlot;
  }
}
