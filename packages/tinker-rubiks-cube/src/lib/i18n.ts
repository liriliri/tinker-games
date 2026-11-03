import startWith from 'licia/startWith'

type Locale = 'en' | 'zh-CN'

interface Messages {
  sizeLabel: string
  scramble: string
  hint: string
  hintStop: string
  best: string
  movesLabel: string
  webglError: string
  cubeLabel: string
  confirmScrambleTitle: string
  confirmSizeTitle: string
  confirmCancel: string
  confirmOk: string
}

const messages: Record<Locale, Messages> = {
  en: {
    sizeLabel: '{n}',
    scramble: 'Scramble',
    hint: 'Auto-solve',
    hintStop: 'Stop auto-solve',
    best: 'Best {time}',
    movesLabel: 'Moves',
    webglError:
      'This browser cannot run WebGL, so the cube cannot be shown. Try a newer Chrome, Edge, or Safari, or turn on hardware acceleration.',
    cubeLabel: "Rubik's Cube",
    confirmScrambleTitle: 'Scramble and lose progress?',
    confirmSizeTitle: 'Change size and lose progress?',
    confirmCancel: 'Cancel',
    confirmOk: 'Confirm',
  },
  'zh-CN': {
    sizeLabel: '{n}',
    scramble: '打乱',
    hint: '自动还原',
    hintStop: '停止还原',
    best: '最佳 {time}',
    movesLabel: '步数',
    webglError:
      '当前浏览器不支持 WebGL，无法显示 3D 魔方。请换用新版 Chrome / Edge / Safari，或在设置里开启硬件加速。',
    cubeLabel: '魔方',
    confirmScrambleTitle: '打乱并放弃当前进度？',
    confirmSizeTitle: '切换阶数并放弃当前进度？',
    confirmCancel: '取消',
    confirmOk: '确认',
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
    // Keep Intl locale fallback already applied at module load.
  }
}

export function t(
  key: keyof Messages,
  vars?: Record<string, string | number>,
): string {
  let text = messages[locale][key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}
