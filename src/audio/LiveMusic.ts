interface Position { x: number; y: number; z: number; }
/** An original eight-bar loop combines chords, bass and synthesized vowel singing at the stage. */
export class LiveMusic {
  private readonly panner: PannerNode;
  private readonly gain: GainNode;
  private next = 0;
  private beat = 0;
  private sources = new Set<OscillatorNode>();
  constructor(private readonly context: AudioContext, output: AudioNode) {
    this.panner = context.createPanner(); this.panner.panningModel = 'HRTF'; this.panner.refDistance = 5; this.panner.rolloffFactor = 1.1;
    this.gain = context.createGain(); this.gain.gain.value = 0; this.gain.connect(this.panner); this.panner.connect(output);
  }
  update(active: boolean, stage?: Position) {
    const now = this.context.currentTime; this.gain.gain.setTargetAtTime(active ? .8 : 0, now, .15);
    if (!active || !stage) { this.next = now; return; }
    this.panner.positionX.value = stage.x; this.panner.positionY.value = stage.y; this.panner.positionZ.value = stage.z;
    if (this.next < now) this.next = now;
    while (this.next < now + .15) {
      const t = this.next, chord = [0, 5, 3, 7][Math.floor(this.beat / 8) % 4], melody = [0, 3, 7, 10, 7, 5, 3, 0, 3, 7, 12, 10, 7, 5, 3, 7][this.beat % 16];
      if (this.beat % 4 === 0) for (const note of [0, 3, 7]) this.note(130.81 * 2 ** ((chord + note) / 12), t, 1.45, .018, 'triangle');
      this.note(65.4 * 2 ** (chord / 12), t, .24, .05, 'sine');
      this.note(261.63 * 2 ** (melody / 12), t + .035, .34, .045, 'sawtooth', this.beat % 4 < 2 ? [750, 1200, 2600] : [450, 900, 2400]);
      if (this.beat % 2 === 0) this.note(74, t, .09, .035, 'sine');
      this.next += .4167; this.beat++;
    }
  }
  private note(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, formants?: number[]) {
    const source = this.context.createOscillator(), envelope = this.context.createGain(), filters: BiquadFilterNode[] = [];
    source.type = type; source.frequency.setValueAtTime(frequency, at); source.frequency.linearRampToValueAtTime(frequency * 1.008, at + duration);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(volume, at + .025); envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    if (formants) for (const hz of formants) { const filter = this.context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = hz; filter.Q.value = 5; source.connect(filter); filter.connect(envelope); filters.push(filter); }
    else source.connect(envelope);
    envelope.connect(this.gain); source.start(at); source.stop(at + duration + .01); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); envelope.disconnect(); filters.forEach(filter => filter.disconnect()); };
  }
  close() { for (const source of this.sources) source.stop(); this.sources.clear(); this.gain.disconnect(); this.panner.disconnect(); }
}
