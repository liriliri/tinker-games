import startWith from 'licia/startWith'

type Locale = 'en' | 'zh-CN'

interface Messages {
  solved: string
  size3: string
  size4: string
  size5: string
}

const messages: Record<Locale, Messages> = {
  en: {
    solved: 'Picture restored',
    size3: '3×3',
    size4: '4×4',
    size5: '5×5',
  },
  'zh-CN': {
    solved: '拼好了',
    size3: '3×3',
    size4: '4×4',
    size5: '5×5',
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
