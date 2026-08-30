export class AudioKit {
  private enabled = true;
  private loadStarted = false;
  private readonly placeAudio = new Audio("sound/place.mp3");

  constructor() {
    this.placeAudio.preload = "auto";
    this.placeAudio.volume = 0.7;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  unlock() {
    if (this.loadStarted) return;
    this.loadStarted = true;
    this.placeAudio.load();
  }

  play() {
    if (!this.enabled) return;
    this.placeAudio.currentTime = 0;
    void this.placeAudio.play().catch(() => {});
  }
}
