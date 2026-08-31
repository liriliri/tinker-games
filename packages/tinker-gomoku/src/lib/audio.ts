export class AudioKit {
  private enabled = true;
  private loadStarted = false;
  private readonly turnAudio = new Audio("sound/turn.mp3");

  constructor() {
    this.turnAudio.preload = "auto";
    this.turnAudio.volume = 0.7;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  unlock() {
    if (this.loadStarted) return;
    this.loadStarted = true;
    this.turnAudio.load();
  }

  play() {
    if (!this.enabled) return;
    this.turnAudio.currentTime = 0;
    void this.turnAudio.play().catch(() => {});
  }
}
