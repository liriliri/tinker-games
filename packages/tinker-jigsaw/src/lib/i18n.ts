import startWith from 'licia/startWith'

type Locale = 'en' | 'zh-CN'

interface Messages {
  leavePrompt: string
  switchPrompt: string
  failPrompt: string
  cancel: string
  confirm: string
  retry: string
  back: string
}

const messages: Record<Locale, Messages> = {
  en: {
    leavePrompt: 'Leave this puzzle?',
    switchPrompt: 'Restart at the new difficulty?',
    failPrompt: 'A piece slid off',
    cancel: 'Cancel',
    confirm: 'Confirm',
    retry: 'Retry',
    back: 'Back',
  },
  'zh-CN': {
    leavePrompt: '返回将离开当前拼图',
    switchPrompt: '切换难度将重新开始',
    failPrompt: '方块滑出了',
    cancel: '取消',
    confirm: '确定',
    retry: '重来',
    back: '返回',
  },
}

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
    // Keep the Intl locale already chosen at module load.
  }
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}

export function getFontFamily(): string {
  return locale === 'zh-CN'
    ? '"Songti SC", "STSong", "Source Han Serif SC", "Noto Serif SC", "PingFang SC", serif'
    : '"Iowan Old Style", Palatino, "Palatino Linotype", "Songti SC", serif'
}
