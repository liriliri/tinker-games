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
    cpuThinking: "Computer is thinking",
    yourMove: "Your move · Black",
    blackWins: "Black wins",
    whiteWins: "White wins",
    draw: "A quiet draw",
    full: "The board is full. No line prevailed.",
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
    cpuThinking: "电脑思考中",
    yourMove: "你的回合 · 黑棋",
    blackWins: "黑棋获胜",
    whiteWins: "白棋获胜",
    draw: "和棋",
    full: "棋盘已满，双方未能连成五子。",
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
      // Fall back to the browser language when Tinker is unavailable.
    }
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}
