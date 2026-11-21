export type SignalColor = 'red' | 'amber' | 'green';
export function trafficSignals(seconds: number): { x: SignalColor; z: SignalColor } {
  const time = (seconds % 28 + 28) % 28;
  return { x: time < 11 ? 'green' : time < 13 ? 'amber' : 'red',
    z: time >= 14 && time < 25 ? 'green' : time >= 25 && time < 27 ? 'amber' : 'red' };
}
export const SIGNAL_COLORS = { red: '#cf5949', amber: '#d0aa5a', green: '#73bd85' } as const;
