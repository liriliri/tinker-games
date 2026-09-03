import startWith from "licia/startWith";

export const copy = {
  en: {
    title: "CHECKERS",
    subtitle: "ENGLISH DRAUGHTS",
    eyebrow: "THE DARK SQUARES",
    intro: "Jump, crown, and clear the board.",
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
    menu: "Menu",
    undo: "Undo",
    sound: "Sound on",
    soundOff: "Sound off",
    whiteTurn: "White to move",
    blackTurn: "Black to move",
    yourMove: "Your move · Black",
    cpuThinking: "Computer is thinking",
    whiteWins: "White wins",
    blackWins: "Black wins",
    draw: "A quiet draw",
    hint: "Select a piece to see its legal moves",
    rulesNote: "Black moves first · Captures are mandatory",
    gameOver: "THE LAST MOVE",
  },
  "zh-CN": {
    title: "英式跳棋",
    subtitle: "六十四格",
    eyebrow: "深色方格",
    intro: "跳跃、升王、清空棋盘。",
    mode: "对弈模式",
    local: "本地双人",
    computer: "挑战电脑",
    difficulty: "电脑水平",
    easy: "入门",
    normal: "稳健",
    hard: "大师",
    start: "开始对局",
    playAgain: "再来一局",
    changeMode: "更换模式",
    menu: "菜单",
    undo: "悔棋",
    sound: "声音已开",
    soundOff: "声音已关",
    whiteTurn: "白方回合",
    blackTurn: "黑方回合",
    yourMove: "你的回合 · 黑方",
    cpuThinking: "电脑思考中",
    whiteWins: "白方胜",
    blackWins: "黑方胜",
    draw: "和棋",
    hint: "选择棋子查看可走位置",
    rulesNote: "黑方先行 · 有吃必吃",
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
      // Browser mode does not provide the optional Tinker bridge.
    }
  }
  return startWith(navigator.language.toLowerCase(), "zh") ? "zh-CN" : "en";
}
