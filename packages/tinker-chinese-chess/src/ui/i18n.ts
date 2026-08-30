export const copy = {
  en: {
    title: "Chinese Chess",
    subtitle: "THE NINE LINES",
    eyebrow: "THE NINE LINES",
    intro:
      "One board, half a book of strategy. Read the river before you move.",
    mode: "MATCH",
    local: "LOCAL 2P",
    computer: "VS CPU",
    difficulty: "CPU LEVEL",
    easy: "BEGINNER",
    normal: "STEADY",
    hard: "MASTER",
    start: "START MATCH",
    playAgain: "PLAY AGAIN",
    changeMode: "CHANGE MODE",
    sound: "Sound",
    soundOff: "Sound off",
    menu: "Menu",
    undo: "Undo",
    redTurn: "Red to move",
    blackTurn: "Black to move",
    cpuThinking: "Computer is thinking",
    yourMove: "Your move · Red",
    redWins: "Red wins",
    blackWins: "Black wins",
    draw: "A quiet draw",
    check: "Check — answer the threat",
    hint: "Select a piece to see legal moves",
    rulesNote: "Red moves first · Check must be answered",
    gameOver: "THE LAST MOVE",
  },
  "zh-CN": {
    title: "中国象棋",
    subtitle: "楚河 · 汉界",
    eyebrow: "九路纵横",
    intro: "一局棋，半卷兵法。落子之前，先看楚河汉界。",
    mode: "对弈模式",
    local: "本地双人",
    computer: "挑战电脑",
    difficulty: "电脑水平",
    easy: "入门",
    normal: "好手",
    hard: "高手",
    start: "开始对局",
    playAgain: "再来一局",
    changeMode: "更换模式",
    sound: "声音",
    soundOff: "声音已关",
    menu: "菜单",
    undo: "悔棋",
    redTurn: "红方回合",
    blackTurn: "黑方回合",
    cpuThinking: "电脑思考中",
    yourMove: "你的回合 · 红方",
    redWins: "红方胜",
    blackWins: "黑方胜",
    draw: "和棋",
    check: "将军 · 请应将",
    hint: "选择棋子查看可走位置",
    rulesNote: "红方先行 · 将军时必须应将",
    gameOver: "终局",
  },
} as const;

export type Locale = keyof typeof copy;
export type Copy = (typeof copy)[Locale];

export async function detectLocale(): Promise<Locale> {
  if (typeof tinker !== "undefined") {
    try {
      const language = await tinker.getLanguage();
      return language === "zh-CN" ? "zh-CN" : "en";
    } catch {
      // Tinker is optional when running the game in a browser.
    }
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
