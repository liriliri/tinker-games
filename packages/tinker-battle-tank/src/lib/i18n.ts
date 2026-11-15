type Locale = 'en' | 'zh-CN'

interface Messages {
  title: string
  subtitle: string
  onePlayer: string
  twoPlayers: string
  selectStage: string
  previewMap: string
  previewHint: string
  controls: string
  playerOne: string
  playerTwo: string
  p1: string
  p2: string
  stage: string
  enemies: string
  lives: string
  score: string
  level: string
  stageClear: string
  gameOver: string
  eagleDestroyed: string
  allDead: string
  allCleared: string
  nextStage: string
  restart: string
  menu: string
  paused: string
  resume: string
  tankBasic: string
  tankFast: string
  tankPower: string
  tankArmor: string
}

const messages: Record<Locale, Messages> = {
  en: {
    title: 'BATTLE TANK',
    subtitle: 'Defend the eagle. Upgrade your tank. Outplay the enemy.',
    onePlayer: '1 PLAYER',
    twoPlayers: '2 PLAYERS',
    selectStage: 'SELECT STAGE',
    previewMap: 'PREVIEW MAP',
    previewHint: 'PREVIEW · ESC',
    controls: 'CONTROLS',
    playerOne: 'PLAYER 1',
    playerTwo: 'PLAYER 2',
    p1: 'P1',
    p2: 'P2',
    stage: 'STAGE',
    enemies: 'ENEMY',
    lives: 'LIVES',
    score: 'SCORE',
    level: 'LEVEL',
    stageClear: 'STAGE CLEAR',
    gameOver: 'GAME OVER',
    eagleDestroyed: 'The eagle has fallen',
    allDead: 'All tanks destroyed',
    allCleared: 'Every stage cleared!',
    nextStage: 'NEXT STAGE',
    restart: 'RESTART',
    menu: 'MENU',
    paused: 'PAUSED',
    resume: 'RESUME',
    tankBasic: 'BASIC',
    tankFast: 'FAST',
    tankPower: 'POWER',
    tankArmor: 'ARMOR',
  },
  'zh-CN': {
    title: '坦克大战',
    subtitle: '守护老鹰基地，升级坦克，与电脑敌军一决高下。',
    onePlayer: '单人游戏',
    twoPlayers: '双人游戏',
    selectStage: '选择关卡',
    previewMap: '预览地图',
    previewHint: '预览中 · ESC 返回',
    controls: '操作说明',
    playerOne: '玩家 1',
    playerTwo: '玩家 2',
    p1: 'P1',
    p2: 'P2',
    stage: '关卡',
    enemies: '敌军',
    lives: '生命',
    score: '得分',
    level: '等级',
    stageClear: '过关',
    gameOver: '游戏结束',
    eagleDestroyed: '老鹰基地被摧毁',
    allDead: '所有坦克被消灭',
    allCleared: '全部关卡已通过！',
    nextStage: '下一关',
    restart: '重新开始',
    menu: '主菜单',
    paused: '已暂停',
    resume: '继续游戏',
    tankBasic: '普通',
    tankFast: '快速',
    tankPower: '火力',
    tankArmor: '装甲',
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
    // Keep the Intl locale fallback already applied at module load.
  }
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}

export function tankLevelName(level: 'basic' | 'fast' | 'power' | 'armor') {
  switch (level) {
    case 'fast':
      return t('tankFast')
    case 'power':
      return t('tankPower')
    case 'armor':
      return t('tankArmor')
    default:
      return t('tankBasic')
  }
}
