import once from "licia/once";

export class AudioKit {
  private enabled = true;
  private readonly turnAudio = new Audio("sound/turn.mp3");
  private readonly unlockAudio = once(() => {
    // Keeping the audio element primed makes browser autoplay policies predictable.
    this.turnAudio.load();
  });

  constructor() {
    this.turnAudio.preload = "auto";
    this.turnAudio.volume = 0.7;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  unlock() {
    this.unlockAudio();
  }

  play() {
    if (!this.enabled) return;
    this.turnAudio.currentTime = 0;
    void this.turnAudio.play().catch(() => {});
  }
}
