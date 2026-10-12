type Locale = 'en' | 'zh-CN'

interface Messages {
  level: string
}

const messages: Record<Locale, Messages> = {
  en: {
    level: 'Level',
  },
  'zh-CN': {
    level: '关卡',
  },
}

function detectLocaleFallback(): Locale {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  return locale.startsWith('zh') ? 'zh-CN' : 'en'
}

let locale: Locale = detectLocaleFallback()

export async function initLanguage(): Promise<void> {
  if (typeof tinker === 'undefined') return
  try {
    const language = await tinker.getLanguage()
    locale = language === 'zh-CN' ? 'zh-CN' : 'en'
  } catch {
    // Keep Intl locale fallback already applied at module load.
  }
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}
