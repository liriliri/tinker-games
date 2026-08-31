export const copy = {
  en: {
    mode: "MODE",
    local: "LOCAL 2P",
    computer: "VS CPU",
    difficulty: "DIFFICULTY",
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    start: "START MATCH",
    playAgain: "PLAY AGAIN",
    changeMode: "CHANGE MODE",
    sound: "Sound",
    soundOff: "Sound off",
    menu: "Menu",
    black: "Black to move",
    white: "White to move",
    pieceSettling: "Pieces are settling",
    yourMove: "Your move · Black",
    cpuThinking: "Computer is thinking",
    pass: "No move · pass",
    blackWins: "Black wins",
    whiteWins: "White wins",
    draw: "A balanced finish",
  },
  "zh-CN": {
    mode: "模式",
    local: "本地双人",
    computer: "电脑对战",
    difficulty: "难度",
    easy: "简单",
    normal: "普通",
    hard: "困难",
    start: "开始对局",
    playAgain: "再来一局",
    changeMode: "更换模式",
    sound: "声音",
    soundOff: "声音已关",
    menu: "菜单",
    black: "黑棋回合",
    white: "白棋回合",
    pieceSettling: "棋子翻转中",
    yourMove: "你的回合 · 黑棋",
    cpuThinking: "电脑思考中",
    pass: "无棋可下 · 跳过",
    blackWins: "黑棋获胜",
    whiteWins: "白棋获胜",
    draw: "势均力敌的和棋",
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
      // Use the browser language when Tinker is unavailable.
    }
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
