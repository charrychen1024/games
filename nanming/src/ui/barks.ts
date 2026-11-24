/* 主帅阵前之言：按人物性情（主战、降意、谋略、统军）与战局取一句。同一人同一情形每次取法固定，不乱跳。 */
import type { Character } from '../core/types';
import { hashKeys } from '../core/rng';

export type BarkWhen = 'open' | 'openDef' | 'lead' | 'stratOk' | 'stratFail' | 'routedMine' | 'routedFoe' | 'ahead' | 'behind' | 'win' | 'lose' | 'breach' | 'hold';
type Temper = 'fierce' | 'steady' | 'crafty' | 'wavering' | 'proud';

export function temperOf(c?: Character): Temper {
  if (!c) return 'steady';
  if (c.att.surrender >= 60) return 'wavering';
  if (c.ab.mou >= 70 && c.ab.mou >= c.ab.tong) return 'crafty';
  if (c.att.hawk >= 55 || c.ab.tong >= 75) return 'fierce';
  if (c.ab.wang >= 70) return 'proud';
  return 'steady';
}

const LINES: Record<BarkWhen, Partial<Record<Temper, string[]>> & { any: string[] }> = {
  open: { any: ['列阵！听我号令。', '诸军整肃，随旗而进。'], fierce: ['今日不破此敌，誓不收兵！', '儿郎们，随我杀！'], crafty: ['敌阵虚实，我已尽知。', '先观其变，再出奇兵。'], wavering: ['且看形势，不可轻进……', '此战胜负难料啊。'], proud: ['区区之众，何足道哉！'], steady: ['稳住阵脚，步步为营。'] },
  openDef: { any: ['守住城头，一寸不让！', '敌来则击，敌退勿追。'], fierce: ['城在人在！', '谁敢言降，立斩！'], wavering: ['城中粮秣，还能撑几日？'], crafty: ['让他来攻，城下便是他的坟。'], steady: ['各守其垛，听鼓而动。'] },
  lead: { any: ['随我来！'], fierce: ['主将在此，谁敢后退！', '看我亲斩敌将！'], proud: ['大旗在前，三军随我！'], wavering: ['……也罢，我亲自去！'] },
  stratOk: { any: ['中计矣！', '此正我所料。'], crafty: ['兵者，诡道也。', '敌已入彀中。'], fierce: ['趁乱掩杀！'] },
  stratFail: { any: ['敌有防备，计不成。', '可惜，被他识破了。'], wavering: ['这……如何是好。'], fierce: ['计不成便硬拼！'] },
  routedMine: { any: ['收拢溃兵，后队顶上！', '一路溃了，稳住其余！'], wavering: ['大势去矣……'], fierce: ['后退者斩！给我顶住！'] },
  routedFoe: { any: ['敌军溃了，追！', '一路已破，乘胜而进！'], fierce: ['杀尽此贼！'], crafty: ['穷寇勿追，先取其中军。'] },
  ahead: { any: ['敌势已衰，再加一鼓！', '好！再进一步！'], proud: ['我早说过，不堪一击。'] },
  behind: { any: ['敌势正盛，暂避其锋。', '传令各路，坚守待机。'], wavering: ['再这样下去……'], fierce: ['不过小挫，再战！'] },
  win: { any: ['敌已败走，鸣金收兵。', '此战大捷！'], proud: ['天下谁能当我！'], steady: ['清点伤亡，安抚士卒。'] },
  lose: { any: ['今日之败，来日必报。', '撤！保全余众。'], wavering: ['降了吧……'], fierce: ['恨不能死于阵前！'] },
  breach: { any: ['城破了！'], fierce: ['登城者赏千金！'] },
  hold: { any: ['城头尚在，敌不得进！'], fierce: ['再来多少，也叫他有来无回！'] },
};

/** 青史有载、合乎其人的话 */
const OWN: Record<string, Partial<Record<BarkWhen, string>>> = {
  shikefa: { openDef: '城存与存，城亡与亡！', lose: '吾头可断，而志不可屈。' },
};

export function barkLine(c: Character | undefined, when: BarkWhen, salt = 0): string {
  const own = c ? OWN[c.id]?.[when] : undefined;
  if (own) return own;
  const pool = LINES[when][temperOf(c)] ?? LINES[when].any;
  const list = pool.length ? pool : LINES[when].any;
  return list[hashKeys((c?.id ?? 'x') + ':' + when + ':' + salt) % list.length];
}
