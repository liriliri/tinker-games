import startWith from 'licia/startWith'
import strTpl from 'licia/strTpl'

type Locale = 'en' | 'zh-CN'

interface Messages {
  title: string
  start: string
  gameOver: string
  newRecord: string
  lives: string
  bombs: string
  multiplier: string
  extraLife: string
  extraBomb: string
  weapon: string
  paused: string
  level: string
}

const messages: Record<Locale, Messages> = {
  en: {
    title: 'geometry fighter',
    start: 'fire to start',
    gameOver: 'game over',
    newRecord: '-new record-',
    lives: 'lives',
    bombs: 'bombs',
    multiplier: 'x{{n}}',
    extraLife: '1up',
    extraBomb: 'bomb',
    weapon: '{{n}}-shot',
    paused: 'paused',
    level: 'level',
  },
  'zh-CN': {
    title: 'geometry fighter',
    start: '点击开火开始',
    gameOver: '游戏结束',
    newRecord: '-新纪录-',
    lives: '生命',
    bombs: '炸弹',
    multiplier: 'x{{n}}',
    extraLife: '续命',
    extraBomb: '炸弹',
    weapon: '{{n}}发',
    paused: '已暂停',
    level: '难度',
  },
}

type MessageKey = keyof Messages

function detectLocaleFallback(): Locale {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  return startWith(locale, 'zh') ? 'zh-CN' : 'en'
}

let locale: Locale = detectLocaleFallback()

export async function initLanguage(): Promise<void> {
  if (typeof tinker === 'undefined') return
  try {
    const language = await tinker.getLanguage()
    locale = language === 'zh-CN' ? 'zh-CN' : 'en'
  } catch {
    // Keep Intl locale fallback.
  }
}

export function t(key: MessageKey): string {
  return messages[locale][key]
}

export function tf(key: MessageKey, vars: Record<string, string | number>) {
  return strTpl(messages[locale][key], vars)
}

export function getFontFamily(): string {
  return '"DIN Alternate", "Avenir Next Condensed", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC", sans-serif'
}
