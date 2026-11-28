import { assetUrl } from '../assets/AssetUrl';
import type { WorldStateStore } from '../world/WorldStateStore';
import type { EventBus } from '../core/EventBus';

export const CONTACTS = [
  { id: 'nia', name: 'Nia', role: '成年邻居', reply: '我在海湾散步。傍晚的灯塔很漂亮，有空一起喝咖啡。', call: '喂？是你呀。我今天休息，正在海边。手机里的城市地图能找到咖啡馆。' },
  { id: 'alex', name: 'Alex', role: 'Fresh & Co. 店员', reply: '收到！便利店全天营业，水和三明治已经补好货。', call: '这里是 Fresh & Co.。欢迎来店里选购补给，也可以接取社区送货。' },
  { id: 'lea', name: 'Lea', role: '28 岁 · Low Tide 驻唱', reply: '今晚我在 Low Tide 一楼演出。上楼的楼梯在左侧，欢迎来听歌。', call: '嗨，我是 Lea。今晚唱的是原创即兴曲《港湾夜航》，演出从下午四点开始。' },
  { id: 'civic', name: 'Civic 服务台', role: '城市服务', reply: '城市服务已收到你的信息。需要出行时，可在手机里呼叫 Azure Ride。', call: '欢迎联系 Civic 城市服务。银行支持现金存取；损坏公共设施会触发警报。' },
] as const;
export type ContactId = typeof CONTACTS[number]['id'];
export const FEED = [
  { id: 'harbor', author: '@nia.azure', title: '给忙碌的城市一点海风', place: 'Azure Bay', video: assetUrl('media/harbor.webm'), likes: 128, color: '#467d91' },
  { id: 'street', author: '@side.streets', title: '下个路口，去哪里？', place: 'Marina Quarter', video: assetUrl('media/street.webm'), likes: 86, color: '#bd855d' },
  { id: 'night', author: '@lowtide.live', title: '今夜的港湾还没睡', place: 'The Low Tide', video: assetUrl('media/night.webm'), likes: 243, color: '#8e699f' },
] as const;
export interface PhoneMessage { id: number; text: string; outgoing: boolean; read: boolean; }
export interface PhoneState {
  nextId: number;
  threads: Partial<Record<ContactId, PhoneMessage[]>>;
  pending: { contact: ContactId; remaining: number }[];
  call: { contact: ContactId; status: 'dialing' | 'connected' | 'ended'; seconds: number; line: string } | null;
  history: { contact: ContactId; seconds: number }[];
  posts: Record<string, { liked: boolean; comments: { id: number; text: string }[] }>;
}
export function defaultPhone(): PhoneState { return { nextId: 1, threads: {}, pending: [], call: null, history: [], posts: {} }; }

/** All phone activity belongs to the fictional city and survives as small world deltas. */
export class PhoneService {
  revision = 0;
  constructor(private readonly world: WorldStateStore, private readonly events: EventBus) {}
  get state() { return this.world.delta.phone ??= defaultPhone(); }
  private changed() { this.revision++; this.events.emit('phoneChanged', undefined); }
  thread(contact: ContactId) {
    const messages = this.state.threads[contact] ??= [{ id: this.state.nextId++, text: CONTACTS.find(item => item.id === contact)!.reply, outgoing: false, read: false }];
    return messages;
  }
  read(contact: ContactId) { this.thread(contact).forEach(message => { message.read = true; }); this.changed(); }
  send(contact: ContactId, raw: string) {
    const text = raw.trim().slice(0, 240); if (!text || !CONTACTS.some(item => item.id === contact)) return false;
    const thread = this.thread(contact); thread.push({ id: this.state.nextId++, text, outgoing: true, read: true }); this.state.threads[contact] = thread.slice(-60);
    if (!this.state.pending.some(item => item.contact === contact)) this.state.pending.push({ contact, remaining: 1.4 });
    this.changed(); return true;
  }
  call(contact: ContactId) {
    if (!CONTACTS.some(item => item.id === contact)) return false;
    this.hangup(); this.state.call = { contact, status: 'dialing', seconds: 0, line: '正在呼叫…' }; this.changed(); return true;
  }
  hangup() {
    const call = this.state.call; if (!call || call.status === 'ended') return;
    this.state.history.unshift({ contact: call.contact, seconds: Math.floor(call.seconds) }); this.state.history = this.state.history.slice(0, 20);
    call.status = 'ended'; call.line = '通话结束'; this.changed();
  }
  like(id: string) { if (!FEED.some(item => item.id === id)) return; const post = this.state.posts[id] ??= { liked: false, comments: [] }; post.liked = !post.liked; this.changed(); }
  comment(id: string, raw: string) {
    const text = raw.trim().slice(0, 160); if (!text || !FEED.some(item => item.id === id)) return false;
    const post = this.state.posts[id] ??= { liked: false, comments: [] }; post.comments.push({ id: this.state.nextId++, text }); post.comments = post.comments.slice(-30); this.changed(); return true;
  }
  update(dt: number) {
    let changed = false;
    for (const item of this.state.pending) item.remaining -= dt;
    for (const item of this.state.pending.filter(item => item.remaining <= 0)) {
      const contact = CONTACTS.find(contact => contact.id === item.contact)!;
      const thread = this.thread(item.contact); thread.push({ id: this.state.nextId++, text: contact.reply, outgoing: false, read: false }); this.state.threads[item.contact] = thread.slice(-60);
      this.events.emit('toast', `${contact.name} 发来新信息`); changed = true;
    }
    this.state.pending = this.state.pending.filter(item => item.remaining > 0);
    const call = this.state.call;
    if (call && call.status !== 'ended') {
      call.seconds += dt;
      if (call.status === 'dialing' && call.seconds >= 1.8) {
        call.status = 'connected'; call.seconds = 0; call.line = CONTACTS.find(item => item.id === call.contact)!.call;
        this.events.emit('speak', { text: call.line }); changed = true;
      }
    }
    if (changed) this.changed();
  }
  get unread() { return Object.values(this.state.threads).flat().filter(message => !message.read && !message.outgoing).length; }
}
