export type GameState = 'boot' | 'play' | 'victory flash'
export type ScreenFlashPhase = 'fade-in' | 'hold' | 'fade-out'

export const TONE_MAPPING_EXPOSURE = 1.42
export const VICTORY_FLASH_PEAK_EXPOSURE = 4.2
export const VICTORY_FLASH_FADE_IN_MS = 520
export const VICTORY_FLASH_FADE_OUT_MS = 920
export const VICTORY_FLASH_MIN_HOLD_MS = 100
export const SHADOW_WARMUP_FRAMES = 4
export const SHADOW_MAP_SIZE = 2048
export const ENV_MAP_SIZE = 128
export const ENV_MAP_UPDATE_INTERVAL = 3
export const ENV_MAP_MOVE_THRESHOLD = 0.05

export const BALL_RADIUS = 0.25
export const POINT_LIGHT_INTENSITY = 2.0
export const PLAY_LIGHT_INTENSITY = POINT_LIGHT_INTENSITY * 0.85
export const AMBIENT_LIGHT_INTENSITY = 0.52
export const SHADOW_INTENSITY = 1.15
export const SHADOW_NORMAL_BIAS = 0.0002
export const SHADOW_RADIUS = 1

export const ROLLING_SOUND_MIN_SPEED = 0.05
export const ROLLING_SOUND_MAX_SPEED = 2.5
export const ROLLING_SOUND_MAX_VOLUME = 0.7
export const ROLLING_SOUND_SPEED_SMOOTHING = 0.18
export const ROLLING_SOUND_VOLUME_SMOOTHING = 0.12
export const HIT_SOUND_MIN_IMPULSE = 0.35
export const HIT_SOUND_MAX_IMPULSE = 2.5
export const HIT_SOUND_MIN_VOLUME = 0.15
export const HIT_SOUND_MAX_VOLUME = 0.65
export const HIT_SOUND_COOLDOWN_MS = 70
