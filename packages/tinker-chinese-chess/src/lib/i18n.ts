import startWith from "licia/startWith";

export const copy = {
  en: {
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
  },
  "zh-CN": {
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
  },
} as const;

export type Locale = keyof typeof copy;
export type Copy = (typeof copy)[Locale];

function localeFromNavigator(): Locale {
  return startWith(navigator.language.toLowerCase(), "zh") ? "zh-CN" : "en";
}

export function detectLocaleFallback(): Locale {
  return localeFromNavigator();
}

export async function detectLocale(): Promise<Locale> {
  if (typeof tinker !== "undefined") {
    try {
      const language = await tinker.getLanguage();
      return language === "zh-CN" ? "zh-CN" : "en";
    } catch {
      // Tinker is optional when running the game in a browser.
    }
  }
  return localeFromNavigator();
}
