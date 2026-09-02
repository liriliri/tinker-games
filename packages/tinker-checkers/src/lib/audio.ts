import once from "licia/once";

export class AudioKit {
  private enabled = true;
  private readonly placeAudio = new Audio("sound/place.mp3");
  private readonly unlockAudio = once(() => this.placeAudio.load());

  constructor() {
    this.placeAudio.preload = "auto";
    this.placeAudio.volume = 0.7;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  unlock() {
    this.unlockAudio();
  }

  play() {
    if (!this.enabled) return;
    this.placeAudio.currentTime = 0;
    void this.placeAudio.play().catch(() => {});
  }
}
