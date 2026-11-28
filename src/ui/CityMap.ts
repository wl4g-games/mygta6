import * as THREE from 'three';
import { storeForChunk } from '../store/StoreArchetype';
import { WORLD, chunkAt } from '../config/game';
import { RoadNetwork } from '../city/RoadNetwork';
export class CityMap {
  waypoint: { x: number; z: number } | null = { x: 32, z: -14 };
  private scale = 1.5;
  private fullCenter: { x: number; z: number } | null = null;
  private readonly roads = new RoadNetwork();
  onWaypoint: (point: { x: number; z: number }) => void = () => {};
  setWaypoint(point: { x: number; z: number }) {
    this.waypoint = { x: THREE.MathUtils.clamp(point.x, -WORLD.halfExtent, WORLD.halfExtent), z: THREE.MathUtils.clamp(point.z, -WORLD.halfExtent, WORLD.halfExtent) };
    this.onWaypoint(this.waypoint);
  }
  fitWorld(canvas: HTMLCanvasElement, player: THREE.Vector3, yaw: number) { this.fullCenter = { x: 0, z: 0 }; this.scale = WORLD.halfExtent / 720 * 1.05; this.draw(canvas, player, yaw, true); }
  followPlayer(canvas: HTMLCanvasElement, player: THREE.Vector3, yaw: number) { this.fullCenter = null; this.scale = 1.5; this.draw(canvas, player, yaw, true); }
  draw(canvas: HTMLCanvasElement, player: THREE.Vector3, yaw: number, full = false) {
    const ctx = canvas.getContext('2d')!, { width: w, height: h } = canvas;
    const center = full ? this.fullCenter ?? player : player;
    const range = full ? 720 * this.scale : 112;
    const zoom = Math.min(w, h) / (range * 2);
    const px = (x: number) => w / 2 + (x - center.x) * zoom;
    const pz = (z: number) => h / 2 + (z - center.z) * zoom;
    canvas.setAttribute('aria-label', full && this.fullCenter ? 'Full 16 × 16 km city map' : 'Map centered on player');
    ctx.fillStyle = '#203e44'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2d6570'; ctx.fillRect(0, 0, Math.max(0, px(-192)), h);
    ctx.strokeStyle = '#70978f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px(-192), 0); ctx.lineTo(px(-192), h); ctx.stroke();
    ctx.fillStyle = '#718780'; ctx.fillRect(0, pz(-521), w, 18 * zoom);
    const c = chunkAt(center.x, center.z), radius = Math.ceil(range / 128) + 2;
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      const cx = (c.x + dx) * 128, cz = (c.z + dz) * 128;
      if (cx < -128 || Math.abs(cx) > WORLD.halfExtent || Math.abs(cz) > WORLD.halfExtent) continue;
      ctx.fillStyle = '#718780';
      ctx.fillRect(px(cx - 64), pz(cz - 8), 128 * zoom, 16 * zoom);
      ctx.fillRect(px(cx - 8), pz(cz - 64), 16 * zoom, 128 * zoom);
      ctx.fillStyle = '#3e5857';
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.fillRect(px(cx + sx * 36 - 18), pz(cz + sz * 36 - 20), 36 * zoom, 40 * zoom);
      const s = storeForChunk(`${c.x + dx},${c.z + dz}`);
      ctx.fillStyle = '#a8c7b1'; ctx.beginPath(); ctx.arc(px(s.x), pz(s.z), full ? 4 : 5, 0, Math.PI * 2); ctx.fill();
      if (full && this.scale < 1.5) {
        ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#c1d1c4'; ctx.fillText(s.archetype.name, px(s.x), pz(s.z) + 17);
      }
    }
    if (this.waypoint) {
      const wx = this.waypoint.x, wz = this.waypoint.z;
      ctx.strokeStyle = '#e1bc79'; ctx.lineWidth = full ? 3 : 4; ctx.setLineDash([7, 5]);
      const route = this.roads.worldRoute(player.x, player.z, wx, wz);
      ctx.beginPath(); ctx.moveTo(px(player.x), pz(player.z));
      for (const node of route) ctx.lineTo(px(node.x), pz(node.z));
      ctx.lineTo(px(wx), pz(wz)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e4c48c'; ctx.beginPath(); ctx.arc(px(wx), pz(wz), 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e4c48c88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(wx), pz(wz), 12, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save(); ctx.translate(px(player.x), pz(player.z)); ctx.rotate(-yaw);
    ctx.shadowColor = '#0b2528'; ctx.shadowBlur = 5; ctx.fillStyle = '#f9ead0';
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(-7, 8); ctx.lineTo(0, 4); ctx.lineTo(7, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    if (full) {
      canvas.onwheel = event => { event.preventDefault(); this.scale = THREE.MathUtils.clamp(this.scale * (event.deltaY > 0 ? 1.2 : .8), .3, 12); this.draw(canvas, player, yaw, true); };
      canvas.onclick = event => {
        const rect = canvas.getBoundingClientRect();
        this.setWaypoint({ x: center.x + ((event.clientX - rect.left) * w / rect.width - w / 2) / zoom,
          z: center.z + ((event.clientY - rect.top) * h / rect.height - h / 2) / zoom });
        this.draw(canvas, player, yaw, true);
      };
    }
  }
}
