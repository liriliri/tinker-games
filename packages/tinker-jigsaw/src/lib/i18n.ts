import startWith from 'licia/startWith'

type Locale = 'en' | 'zh-CN'

interface Messages {
  leavePrompt: string
  switchPrompt: string
  failPrompt: string
  clearPrompt: string
  clearNextPrompt: string
  cancel: string
  confirm: string
  retry: string
  back: string
  next: string
}

const messages: Record<Locale, Messages> = {
  en: {
    leavePrompt: 'Leave this puzzle?',
    switchPrompt: 'Restart at the new difficulty?',
    failPrompt: 'A piece got away',
    clearPrompt: 'This picture is complete',
    clearNextPrompt: 'Try the next difficulty?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    retry: 'Retry',
    back: 'Back',
    next: 'Next',
  },
  'zh-CN': {
    leavePrompt: '返回将离开当前拼图',
    switchPrompt: '切换难度将重新开始',
    failPrompt: '没接住这块碎片',
    clearPrompt: '这张拼好了',
    clearNextPrompt: '继续下一难度？',
    cancel: '取消',
    confirm: '确定',
    retry: '重来',
    back: '返回',
    next: '下一难度',
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
