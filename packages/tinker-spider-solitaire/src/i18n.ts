import startWith from 'licia/startWith'

export type Locale = 'en' | 'zh-CN'

export interface Messages {
  score: string
  moves: string
  newGame: string
  youWin: string
  selectDifficulty: string
  difficulty_easy: string
  difficulty_medium: string
  difficulty_hard: string
  difficulty_easy_short: string
  difficulty_medium_short: string
  difficulty_hard_short: string
  emptyColumn: string
}

const messages: Record<Locale, Messages> = {
  en: {
    score: 'Score',
    moves: 'Moves',
    newGame: 'New Game',
    youWin: 'You win!',
    selectDifficulty: 'Select Difficulty',
    difficulty_easy: 'Easy (1 Suit)',
    difficulty_medium: 'Medium (2 Suits)',
    difficulty_hard: 'Hard (4 Suits)',
    difficulty_easy_short: 'Easy',
    difficulty_medium_short: 'Medium',
    difficulty_hard_short: 'Hard',
    emptyColumn: 'All columns must have at least one card before dealing.',
  },
  'zh-CN': {
    score: '得分',
    moves: '步数',
    newGame: '新游戏',
    youWin: '你赢了！',
    selectDifficulty: '选择难度',
    difficulty_easy: '简单（单色）',
    difficulty_medium: '中等（双色）',
    difficulty_hard: '困难（四色）',
    difficulty_easy_short: '简单',
    difficulty_medium_short: '中等',
    difficulty_hard_short: '困难',
    emptyColumn: '发牌前每列至少需要一张牌。',
  },
}

function detectLocaleFallback(): Locale {
  const lang = navigator.language.toLowerCase()
  return lang === 'zh-cn' || startWith(lang, 'zh') ? 'zh-CN' : 'en'
}

let locale: Locale = detectLocaleFallback()

export function setLocale(loc: string) {
  locale = loc === 'zh-CN' ? 'zh-CN' : 'en'
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}

export function difficultyShortLabel(difficulty: 1 | 2 | 4): string {
  switch (difficulty) {
    case 1:
      return t('difficulty_easy_short')
    case 2:
      return t('difficulty_medium_short')
    case 4:
      return t('difficulty_hard_short')
  }
}

export function getFontFamily(): string {
  return locale === 'zh-CN'
    ? '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    : '"Helvetica Neue", Arial, sans-serif'
}
