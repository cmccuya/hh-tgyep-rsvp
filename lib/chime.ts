/** An original bell pattern. Not a recording of a published song. */
const MELODY = [
  523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 440.0, 493.88,
  523.25, 659.25, 587.33,
];

export class Chime {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;

  async start() {
    if (this.timer) return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const tick = () => {
      if (!this.ctx) return;
      this.strike(this.ctx.currentTime);
    };
    tick();
    this.timer = setInterval(tick, 540);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private strike(time: number) {
    if (!this.ctx || !this.master) return;
    const freq = MELODY[this.step % MELODY.length];
    this.step += 1;

    const fundamental = this.ctx.createOscillator();
    const shimmer = this.ctx.createOscillator();
    const body = this.ctx.createGain();
    const air = this.ctx.createGain();

    fundamental.type = "sine";
    shimmer.type = "sine";
    fundamental.frequency.value = freq;
    shimmer.frequency.value = freq * 2.49;
    air.gain.value = 0.12;

    body.gain.setValueAtTime(0.0001, time);
    body.gain.exponentialRampToValueAtTime(0.85, time + 0.018);
    body.gain.exponentialRampToValueAtTime(0.0001, time + 0.85);

    fundamental.connect(body);
    shimmer.connect(air);
    air.connect(body);
    body.connect(this.master);

    fundamental.start(time);
    shimmer.start(time);
    fundamental.stop(time + 0.9);
    shimmer.stop(time + 0.9);
  }
}
