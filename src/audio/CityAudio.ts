import { LiveMusic } from './LiveMusic';
interface Position { x: number; y: number; z: number; }
interface Ambience { inside: boolean; rain: boolean; walking: number; swimming: boolean; bar: boolean; wanted: number; listener?: Position; police?: Position; stage?: Position; yaw?: number; }

/** Original, locally synthesized layers; no remote audio service or unlicensed samples. */
export class CityAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private noise?: AudioBuffer;
  private street?: GainNode;
  private rain?: GainNode;
  private crowd?: GainNode;
  private streetFilter?: BiquadFilterNode;
  private lastStep = 0;
  private lastBird = 0;
  private music?: LiveMusic;
  private siren?: OscillatorNode;
  private sirenGain?: GainNode;
  private sirenPanner?: PannerNode;
  private pendingThunder = new Set<number>();
  volume = .25;
  start() {
    if (this.context) { void this.context.resume(); return; }
    const context = this.context = new AudioContext(); this.master = context.createGain(); this.master.gain.value = this.volume; this.master.connect(context.destination);
    this.music = new LiveMusic(context, this.master);
    this.noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = this.noise.getChannelData(0); let previous = 0;
    for (let i = 0; i < data.length; i++) { previous = previous * .87 + (Math.random() * 2 - 1) * .13; data[i] = previous * 2; }
    this.engineGain = context.createGain(); this.engineGain.gain.value = 0;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
    this.engine = context.createOscillator(); this.engine.type = 'sawtooth'; this.engine.frequency.value = 42;
    this.engine.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master); this.engine.start();
    const layer = (frequency: number, type: BiquadFilterType) => {
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = this.noise!; source.loop = true; filter.type = type; filter.frequency.value = frequency; gain.gain.value = 0;
      source.connect(filter); filter.connect(gain); gain.connect(this.master!); source.start(); return { gain, filter };
    };
    const street = layer(350, 'lowpass'); this.street = street.gain; this.streetFilter = street.filter;
    this.rain = layer(1900, 'highpass').gain; this.crowd = layer(700, 'bandpass').gain;
    this.siren = context.createOscillator(); this.siren.type = 'sine'; this.sirenGain = context.createGain(); this.sirenGain.gain.value = 0;
    this.sirenPanner = context.createPanner(); this.sirenPanner.panningModel = 'HRTF'; this.sirenPanner.refDistance = 12; this.sirenPanner.maxDistance = 180; this.sirenPanner.rolloffFactor = 2;
    this.siren.connect(this.sirenGain); this.sirenGain.connect(this.sirenPanner); this.sirenPanner.connect(this.master); this.siren.start();
  }
  update(speed: number, driving: boolean, paused: boolean, ambience: Ambience = { inside: false, rain: false, walking: 0, swimming: false, bar: false, wanted: 0 }) {
    if (!this.context || !this.master || !this.engineGain || !this.engine) return;
    const now = this.context.currentTime;
    if (ambience.listener) {
      const listener = this.context.listener, p = ambience.listener;
      listener.positionX.setTargetAtTime(p.x, now, .04); listener.positionY.setTargetAtTime(p.y + .8, now, .04); listener.positionZ.setTargetAtTime(p.z, now, .04);
      listener.forwardX.value = -Math.sin(ambience.yaw ?? 0); listener.forwardY.value = 0; listener.forwardZ.value = -Math.cos(ambience.yaw ?? 0);
    }
    if (this.siren && this.sirenGain && this.sirenPanner) {
      const police = ambience.police;
      this.siren.frequency.setTargetAtTime(640 + Math.sin(now * 4) * 230, now, .03);
      this.sirenGain.gain.setTargetAtTime(police && ambience.wanted && !paused ? ambience.inside ? .01 : .035 : 0, now, .2);
      if (police) { this.sirenPanner.positionX.value = police.x; this.sirenPanner.positionY.value = police.y; this.sirenPanner.positionZ.value = police.z; }
    }
    this.master.gain.setTargetAtTime(this.volume * (paused ? .5 : 1), now, .15);
    this.engine.frequency.setTargetAtTime(42 + (speed % 11) * 5 + Math.floor(speed / 11) * 3, now, .15);
    this.engineGain.gain.setTargetAtTime(driving && !paused ? .025 + Math.min(.035, speed * .001) : 0, now, .15);
    this.street!.gain.setTargetAtTime(ambience.inside ? .008 : .025, now, .4);
    this.streetFilter!.frequency.setTargetAtTime(ambience.inside ? 150 : 400 + Math.sin(now * .4) * 100, now, .5);
    this.rain!.gain.setTargetAtTime(ambience.rain ? ambience.inside ? .015 : .045 : 0, now, .4);
    this.crowd!.gain.setTargetAtTime((ambience.inside ? .008 : .018) * (.7 + Math.sin(now * .9) * .25), now, .2);
    if (!paused && !driving && ambience.walking > .5 && now - this.lastStep > (ambience.swimming ? .5 : ambience.walking > 5 ? .22 : .38)) {
      this.lastStep = now; this.rustle(ambience.swimming ? 420 : 800, .035, ambience.swimming ? .15 : .07);
    }
    if (!ambience.inside && !ambience.rain && now - this.lastBird > 12) { this.lastBird = now; this.tone(2400, 3400, .15, .012, 'sine'); }
    this.music?.update(ambience.bar && !paused, ambience.stage);
  }
  private tone(from: number, to: number, seconds: number, level: number, type: OscillatorType) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime, source = this.context.createOscillator(), gain = this.context.createGain();
    source.type = type; source.frequency.setValueAtTime(from, now); source.frequency.exponentialRampToValueAtTime(to, now + seconds);
    gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
    source.connect(gain); gain.connect(this.master); source.start(); source.stop(now + seconds);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }
  private rustle(frequency: number, level: number, seconds: number) {
    if (!this.context || !this.master || !this.noise) return;
    const now = this.context.currentTime, source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(level, now); gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(now, Math.random(), seconds);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  chime() { this.tone(660, 880, .25, .035, 'sine'); }
  capture() {
    if (!this.context || !this.master) return undefined;
    const destination = this.context.createMediaStreamDestination(); this.master.connect(destination);
    return { stream: destination.stream, close: () => { this.master?.disconnect(destination); destination.stream.getTracks().forEach(track => track.stop()); } };
  }
  horn() { this.tone(280, 280, .25, .055, 'square'); this.tone(350, 350, .25, .025, 'triangle'); }
  impact() { this.rustle(650, .08, .2); }
  shot() { this.rustle(2200, .06, .1); }
  thunder(distance: number) {
    const timer = window.setTimeout(() => { this.pendingThunder.delete(timer); this.rustle(220, .08, 1.8); }, distance / 343 * 1000);
    this.pendingThunder.add(timer);
  }
  close() { this.music?.close(); for (const timer of this.pendingThunder) clearTimeout(timer); this.pendingThunder.clear(); this.engine?.stop(); this.siren?.stop(); void this.context?.close(); }
}
