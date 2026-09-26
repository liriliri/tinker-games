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
  const lang = navigator.language.toLowerCase()
  return lang === 'zh-cn' || lang.startsWith('zh') ? 'zh-CN' : 'en'
}

let locale: Locale = detectLocaleFallback()

export function setLocale(loc: string) {
  locale = loc === 'zh-CN' ? 'zh-CN' : 'en'
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}
