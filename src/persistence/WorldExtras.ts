import type { WorldDelta } from '../world/WorldStateStore';
import { CONTACTS, FEED } from '../phone/PhoneService';
import { WORLD } from '../config/game';

const contact = (id: unknown) => CONTACTS.some(item => item.id === id);
const integer = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const position = (p: { x: number; z: number } | undefined) => !!p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= WORLD.halfExtent && Math.abs(p.z) <= WORLD.halfExtent;
/** Optional additive deltas keep v4 saves compatible while validating each subsystem's bounded data. */
export function validateWorldExtras(world: WorldDelta) {
  if (world.machines && Object.values(world.machines).some(machine => !machine || !Number.isFinite(machine.health) || machine.health < 0 || machine.health > 100 || typeof machine.claimed !== 'boolean' || typeof machine.alarmed !== 'boolean')) return false;
  const phone = world.phone;
  if (phone) {
    if (!integer(phone.nextId) || !phone.threads || !Array.isArray(phone.pending) || phone.pending.length > 4 || !Array.isArray(phone.history) || phone.history.length > 20 || !phone.posts) return false;
    if (Object.entries(phone.threads).some(([id, messages]) => !contact(id) || !Array.isArray(messages) || messages.length > 60 || messages.some(message => !message || !integer(message.id) || !text(message.text, 240) || typeof message.outgoing !== 'boolean' || typeof message.read !== 'boolean'))) return false;
    if (phone.pending.some(item => !contact(item.contact) || !Number.isFinite(item.remaining) || item.remaining < 0 || item.remaining > 10)) return false;
    if (phone.history.some(item => !contact(item.contact) || !integer(item.seconds))) return false;
    if (phone.call && (!contact(phone.call.contact) || !['dialing', 'connected', 'ended'].includes(phone.call.status) || !Number.isFinite(phone.call.seconds) || phone.call.seconds < 0 || !text(phone.call.line, 500))) return false;
    if (Object.entries(phone.posts).some(([id, post]) => !FEED.some(item => item.id === id) || !post || typeof post.liked !== 'boolean' || !Array.isArray(post.comments) || post.comments.length > 30 || post.comments.some(comment => !integer(comment.id) || !text(comment.text, 160)))) return false;
  }
  const ride = world.hailedRide;
  return !ride || ['arriving', 'waiting', 'riding', 'arrived'].includes(ride.stage) && position(ride.destination) && position(ride.pickup) && position(ride.position) && Number.isFinite(ride.yaw) && integer(ride.fee) && text(ride.destinationName, 100) && (ride.passenger === undefined || typeof ride.passenger === 'boolean');
}
