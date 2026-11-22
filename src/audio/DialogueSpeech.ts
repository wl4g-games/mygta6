/** Local browser voices add audible dialogue without contacting real people or services. */
export class DialogueSpeech {
  private active?: SpeechSynthesisUtterance;
  volume = .25;
  say(text: string) {
    if (!('speechSynthesis' in window) || this.volume <= 0) return;
    this.stop(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = .98; utterance.volume = Math.min(1, this.volume * 1.8);
    const voices = speechSynthesis.getVoices().filter(voice => voice.localService), voice = voices.find(voice => voice.lang.startsWith('zh')) ?? voices.find(voice => voice.lang.startsWith('en'));
    if (!voice) return;
    utterance.voice = voice; this.active = utterance; speechSynthesis.speak(utterance);
  }
  stop() { if (this.active && 'speechSynthesis' in window) speechSynthesis.cancel(); this.active = undefined; }
}
