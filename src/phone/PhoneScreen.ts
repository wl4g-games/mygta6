import { CONTACTS, FEED, type ContactId, type PhoneService } from './PhoneService';
import type { PlaceEntry } from '../city/Places';

export interface PhoneScreenPorts {
  places: PlaceEntry[];
  profile(): { cash: number; bank: number; time: string };
  volume(): number;
  navigate(id: string): void;
  driverJob(): void;
  jobActive(): boolean;
  requestRide(id: string): void;
  cancelRide(): void;
  rideStatus(): { stage: string; text: string };
}
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
type App = 'home' | 'calls' | 'messages' | 'feed' | 'rides' | 'maps';

/** A bounded, local phone UI. It owns media playback and all its DOM listeners. */
export class PhoneScreen {
  private app: App = 'home';
  private contact: ContactId = 'nia';
  private post = 0;
  private lastRevision = -1;
  private lastRide = '';
  private destination = '';
  private touchY = 0;
  private sound = false;
  constructor(private readonly host: HTMLElement, private readonly service: PhoneService, private readonly ports: PhoneScreenPorts) {
    this.destination = ports.places.find(entry => entry.store.archetype.kind === 'cafe')?.store.id ?? ports.places[0]?.store.id ?? '';
    host.className = 'phone-device'; host.setAttribute('aria-label', 'SIGNAL 游戏内手机');
    host.addEventListener('wheel', this.wheel, { passive: false }); host.addEventListener('touchstart', this.touchStart); host.addEventListener('touchend', this.touchEnd);
    host.addEventListener('keydown', this.key); this.render();
  }
  get currentApp() { return this.app; }
  get video() { return this.host.querySelector<HTMLVideoElement>('video') ?? undefined; }
  get summary() { const call = this.service.state.call; return { app: this.app, title: this.app === 'calls' && call ? CONTACTS.find(item => item.id === call.contact)!.name : this.app === 'feed' ? FEED[this.post].title : 'SIGNAL', unread: this.service.unread }; }
  private switch(app: App) { this.video?.pause(); this.app = app; this.render(); }
  private wheel = (event: WheelEvent) => { if (this.app !== 'feed') return; event.preventDefault(); if (Math.abs(event.deltaY) > 5) this.next(event.deltaY > 0 ? 1 : -1); };
  private touchStart = (event: TouchEvent) => { this.touchY = event.changedTouches[0]?.clientY ?? 0; };
  private touchEnd = (event: TouchEvent) => { if (this.app === 'feed' && Math.abs((event.changedTouches[0]?.clientY ?? 0) - this.touchY) > 45) this.next((event.changedTouches[0].clientY - this.touchY) < 0 ? 1 : -1); };
  private key = (event: KeyboardEvent) => { if (this.app === 'feed' && !(event.target instanceof HTMLInputElement) && ['ArrowUp', 'ArrowDown'].includes(event.code)) { event.preventDefault(); this.next(event.code === 'ArrowDown' ? 1 : -1); } };
  private next(direction: number) { this.video?.pause(); this.post = (this.post + direction + FEED.length) % FEED.length; this.render(); }
  private render() {
    const focus = document.activeElement instanceof HTMLInputElement && this.host.contains(document.activeElement) ? { id: document.activeElement.id, text: document.activeElement.value } : null;
    const profile = this.ports.profile(), call = this.service.state.call;
    this.video?.pause();
    this.host.innerHTML = `<div class="phone-island"></div><header class="phone-status"><b>${profile.time}</b><span>▂▄▆  ◉  ▰</span></header><div class="phone-top"><button id="phone-home" aria-label="返回手机主屏">‹</button><b>${this.app === 'home' ? 'SIGNAL' : ({ calls: '电话', messages: '信息', feed: 'PULSE', rides: 'AZURE RIDE', maps: '城市地图' })[this.app]}</b><span>PORT AZURE</span></div><main class="phone-content" id="phone-content"></main><div class="phone-home-indicator"></div>`;
    this.host.querySelector<HTMLButtonElement>('#phone-home')!.onclick = () => this.switch('home');
    const content = this.host.querySelector<HTMLElement>('#phone-content')!;
    if (this.app === 'home') {
      content.innerHTML = `<div class="phone-weather"><small>PORT AZURE</small><h2>海风正好。</h2><p>现金 $${profile.cash} · 银行 $${profile.bank}</p></div><div class="phone-app-grid">${[['calls','☎','电话'],['messages','▤','信息'],['feed','▶','PULSE'],['rides','↗','叫车'],['maps','⌖','地图']].map(([app, glyph, label]) => `<button data-app="${app}"><i class="app-${app}">${glyph}</i><span>${label}${app === 'messages' && this.service.unread ? ` · ${this.service.unread}` : ''}</span></button>`).join('')}</div><div class="phone-note">给城市里的朋友打个电话，或叫一辆车去海边。</div>`;
      content.querySelectorAll<HTMLButtonElement>('[data-app]').forEach(button => button.onclick = () => this.switch(button.dataset.app as App));
    } else if (this.app === 'calls') {
      const active = call && call.status !== 'ended';
      content.innerHTML = active ? `<section class="phone-call"><div class="contact-avatar">${escape(CONTACTS.find(item => item.id === call.contact)!.name[0])}</div><h2>${escape(CONTACTS.find(item => item.id === call.contact)!.name)}</h2><p id="call-time">${call.status === 'dialing' ? '正在呼叫…' : '已接通'}</p><p class="call-transcript">${escape(call.line)}</p><button id="hangup" class="hangup">挂断</button></section>` : `<h3>城市联系人</h3>${CONTACTS.map(item => `<button class="phone-contact" data-call="${item.id}"><i>${item.name[0]}</i><span><b>${item.name}</b><small>${item.role}</small></span><em>☎</em></button>`).join('')}<h3>最近通话</h3>${this.service.state.history.slice(0, 5).map(item => `<p class="phone-note">${CONTACTS.find(contact => contact.id === item.contact)!.name} · ${item.seconds} 秒</p>`).join('') || '<p class="phone-note">还没有通话记录</p>'}`;
      content.querySelector<HTMLButtonElement>('#hangup')?.addEventListener('click', () => this.service.hangup());
      content.querySelectorAll<HTMLButtonElement>('[data-call]').forEach(button => button.onclick = () => this.service.call(button.dataset.call as ContactId));
    } else if (this.app === 'messages') {
      content.innerHTML = `<div class="message-tabs">${CONTACTS.map(item => `<button data-thread="${item.id}" class="${item.id === this.contact ? 'selected' : ''}">${item.name}</button>`).join('')}</div><div class="message-thread">${this.service.thread(this.contact).map(message => `<p class="message ${message.outgoing ? 'outgoing' : 'incoming'}">${escape(message.text)}</p>`).join('')}</div><form id="phone-message-form" class="phone-compose"><input id="phone-message" maxlength="240" placeholder="发送城市信息…" aria-label="信息内容" autocomplete="off"><button type="submit">发送</button></form>`;
      content.querySelectorAll<HTMLButtonElement>('[data-thread]').forEach(button => button.onclick = () => { this.contact = button.dataset.thread as ContactId; this.service.read(this.contact); this.render(); });
      content.querySelector<HTMLFormElement>('form')!.onsubmit = event => { event.preventDefault(); const input = content.querySelector<HTMLInputElement>('input')!; if (this.service.send(this.contact, input.value)) { input.value = ''; this.render(); } };
      content.querySelector('.message-thread')!.scrollTop = 100000;
    } else if (this.app === 'feed') {
      const post = FEED[this.post], state = this.service.state.posts[post.id];
      content.innerHTML = `<div class="phone-feed"><video id="phone-video" src="${post.video}" autoplay loop muted playsinline preload="metadata" aria-label="${post.title}"></video><div class="feed-caption"><small>${post.place}</small><b>${post.author}</b><p>${post.title}</p></div><div class="feed-actions"><button id="feed-like" aria-pressed="${!!state?.liked}">♥<small>${post.likes + (state?.liked ? 1 : 0)}</small></button><button id="feed-sound" aria-label="切换短视频声音">♪</button><button id="feed-next" aria-label="下一个短视频">↓</button><button id="feed-prev" aria-label="上一个短视频">↑</button></div></div><div class="feed-comments">${(state?.comments ?? []).map(comment => `<p><b>你</b> ${escape(comment.text)}</p>`).join('')}</div><form id="phone-comment-form" class="phone-compose"><input id="phone-comment" maxlength="160" placeholder="留下评论…" aria-label="评论内容"><button type="submit">评论</button></form>`;
      const video = this.video!; video.volume = this.ports.volume(); video.muted = !this.sound; void video.play().catch(() => {}); video.onclick = () => { if (video.paused) void video.play(); else video.pause(); };
      content.querySelector<HTMLButtonElement>('#feed-like')!.onclick = () => { this.service.like(post.id); this.render(); };
      content.querySelector<HTMLButtonElement>('#feed-next')!.onclick = () => this.next(1); content.querySelector<HTMLButtonElement>('#feed-prev')!.onclick = () => this.next(-1);
      const sound = content.querySelector<HTMLButtonElement>('#feed-sound')!; sound.setAttribute('aria-pressed', String(this.sound));
      sound.onclick = () => { this.sound = !this.sound; video.muted = !this.sound; sound.setAttribute('aria-pressed', String(this.sound)); };
      content.querySelector<HTMLFormElement>('form')!.onsubmit = event => { event.preventDefault(); const input = content.querySelector<HTMLInputElement>('input')!; if (this.service.comment(post.id, input.value)) { input.value = ''; this.render(); } };
    } else if (this.app === 'rides') {
      content.innerHTML = `<div class="ride-brand"><small>AZURE RIDE</small><h2>城市，随时出发。</h2><p>司机来接你，驶向选定目的地。</p></div><label class="ride-destination">目的地<select id="ride-destination">${this.ports.places.filter(entry => !entry.store.archetype.requiredFlag).map(entry => `<option value="${entry.store.id}">${entry.store.archetype.name} · ${Math.round(entry.distance)}m</option>`).join('')}</select></label><p id="ride-status" class="phone-note"></p><button id="request-ride" class="ride-request">呼叫司机</button><button id="cancel-ride">取消叫车</button><hr><p class="phone-note">也可以驾驶自己的汽车，为邻居提供接送。</p><button id="taxi-job">${this.ports.jobActive() ? '取消当前接送任务' : '我要接单 · 赚取车费'}</button>`;
      const select = content.querySelector<HTMLSelectElement>('select')!; select.value = this.destination; select.onchange = () => { this.destination = select.value; };
      content.querySelector<HTMLButtonElement>('#request-ride')!.onclick = () => this.ports.requestRide(this.destination);
      content.querySelector<HTMLButtonElement>('#cancel-ride')!.onclick = () => this.ports.cancelRide();
      content.querySelector<HTMLButtonElement>('#taxi-job')!.onclick = () => this.ports.driverJob();
    } else {
      content.innerHTML = `<p class="phone-note">选择真实商铺设置 GPS</p><div id="places">${this.ports.places.map(({ store, distance }) => `<article class="phone-place"><b>${store.archetype.name}</b><small>${Math.round(distance)} m · ${store.archetype.subtitle}</small><button data-destination="${store.archetype.kind}" data-store="${store.id}">GPS 导航</button></article>`).join('')}</div>`;
      content.querySelectorAll<HTMLButtonElement>('[data-store]').forEach(button => button.onclick = () => this.ports.navigate(button.dataset.store!));
    }
    if (focus) { const input = this.host.querySelector<HTMLInputElement>(`#${focus.id}`); if (input) { input.value = focus.text; input.focus(); } }
    this.lastRevision = this.service.revision; this.lastRide = this.ports.rideStatus().stage;
  }
  sync() {
    if (this.lastRevision !== this.service.revision || this.lastRide !== this.ports.rideStatus().stage) this.render();
    const call = this.service.state.call, timer = this.host.querySelector('#call-time');
    if (timer && call?.status === 'connected') timer.textContent = `${String(Math.floor(call.seconds / 60)).padStart(2, '0')}:${String(Math.floor(call.seconds % 60)).padStart(2, '0')} · 已接通`;
    const status = this.host.querySelector('#ride-status'); if (status) status.textContent = this.ports.rideStatus().text;
  }
  close() { this.video?.pause(); this.host.removeEventListener('wheel', this.wheel); this.host.removeEventListener('touchstart', this.touchStart); this.host.removeEventListener('touchend', this.touchEnd); this.host.removeEventListener('keydown', this.key); this.host.replaceChildren(); }
}
