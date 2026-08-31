import once from "licia/once";

export class AudioKit {
  private enabled = true;
  private readonly moveAudio = new Audio("sound/move.mp3");
  private readonly captureAudio = new Audio("sound/capture.mp3");
  private readonly unlockAudio = once(() => {
    // Keeping the audio element primed makes browser autoplay policies predictable.
    this.moveAudio.load();
    this.captureAudio.load();
  });

  constructor() {
    this.moveAudio.preload = "auto";
    this.captureAudio.preload = "auto";
    this.moveAudio.volume = 0.7;
    this.captureAudio.volume = 0.8;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  unlock() {
    this.unlockAudio();
  }

  play(capture = false) {
    if (!this.enabled) return;
    const audio = capture ? this.captureAudio : this.moveAudio;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }
}
