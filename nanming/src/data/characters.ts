/* 开局人物（1644 年夏）。能力：统军、政务、谋略、外交、威望；态度：忠诚、降意、主战。 */
import type { Character } from '../core/types';

type AB = [number, number, number, number, number];
const C = (id: string, name: string, faction: string, title: string, ab: AB, att: [number, number, number], location: string, bio: string): Character => ({
  id, name, faction, title,
  ab: { tong: ab[0], zheng: ab[1], mou: ab[2], wai: ab[3], wang: ab[4] },
  att: { loyalty: att[0], surrender: att[1], hawk: att[2] },
  attLog: [], location, status: 'active', bio,
});

export const CHARACTERS: Character[] = [
  // 弘光朝廷
  C('zhuyousong', '朱由崧', 'hongguang', '弘光帝', [15, 25, 20, 30, 55], [100, 10, -20], 'nanjing', '福王。北京失守后由江南诸臣拥立于南京。'),
  C('shikefa', '史可法', 'hongguang', '兵部尚书 · 东阁大学士', [62, 80, 55, 70, 90], [98, 0, 70], 'nanjing', '以清操著称。主张经略中原，调和四镇。'),
  C('mashiying', '马士英', 'hongguang', '内阁首辅', [35, 55, 70, 55, 40], [70, 30, -30], 'nanjing', '凤阳总督，以拥立之功入阁，掌朝政。'),
  C('ruandacheng', '阮大铖', 'hongguang', '兵部侍郎', [30, 45, 72, 50, 20], [60, 45, -10], 'nanjing', '阉党旧人，与东林、复社积怨甚深。'),
  C('qianqianyi', '钱谦益', 'hongguang', '礼部尚书', [10, 60, 50, 70, 75], [60, 55, -40], 'nanjing', '东林领袖，文坛宗主。'),
  C('zhaozhilong', '赵之龙', 'hongguang', '忻城伯 · 守备南京', [40, 35, 30, 40, 35], [55, 62, -30], 'nanjing', '勋臣，总督京营戎政。'),
  C('zuomaodi', '左懋第', 'hongguang', '兵部右侍郎', [30, 60, 50, 78, 70], [95, 3, 40], 'nanjing', '刚直有气节，可充北使。'),
  C('liuzhaoji', '刘肇基', 'hongguang', '总兵', [62, 30, 40, 30, 45], [90, 8, 60], 'yangzhou', '辽东宿将，驻扬州。'),
  C('yuanjixian', '袁继咸', 'hongguang', '总督 · 驻九江', [50, 65, 50, 60, 70], [92, 15, 30], 'jiujiang', '总督江西、湖广、安庆军务，与左良玉相善。'),
  C('zhangguowei', '张国维', 'hongguang', '兵部尚书衔', [45, 70, 55, 55, 65], [90, 10, 40], 'hangzhou', '浙人，曾督治水利。'),
  // 江北四镇
  C('gaojie', '高杰', 'gaojie', '兴平伯', [75, 20, 40, 25, 55], [45, 30, 40], 'yangzhou', '李自成旧部降明，兵强而骄。驻兵扬州城外，欲入城而城民拒之。'),
  C('libenshen', '李本深', 'gaojie', '总兵', [58, 20, 30, 20, 30], [40, 62, 10], 'xuzhou', '高杰外甥，部将。'),
  C('liuzeqing', '刘泽清', 'liuzeqing', '东平伯', [50, 30, 45, 35, 30], [38, 70, -20], 'huaian', '据淮安，好营私第。'),
  C('liuliangzuo', '刘良佐', 'liuliangzuo', '广昌伯', [55, 25, 35, 30, 35], [42, 70, -10], 'fengyang', '据凤阳、寿州。'),
  C('huangdegong', '黄得功', 'huangdegong', '靖南伯', [78, 30, 40, 30, 65], [85, 5, 65], 'luzhou', '骁勇善战，号“黄闯子”。'),
  // 左良玉部
  C('zuoliangyu', '左良玉', 'zuoliangyu', '宁南侯', [70, 30, 45, 40, 60], [40, 35, 20], 'wuchang', '坐镇武昌，拥众数十万，素与东林亲近。'),
  C('zuomenggeng', '左梦庚', 'zuoliangyu', '总兵', [45, 25, 30, 25, 30], [35, 70, -10], 'wuchang', '左良玉之子。'),
  // 各省
  C('hetengjiao', '何腾蛟', 'mingprov', '湖广巡抚', [50, 60, 55, 60, 65], [90, 8, 50], 'changsha', '驻长沙，经营湖南。'),
  C('qushisi', '瞿式耜', 'mingprov', '广西巡抚', [40, 70, 60, 60, 70], [95, 3, 50], 'guilin', '常熟人，东林后进。'),
  C('mutianbo', '沐天波', 'mingprov', '黔国公', [45, 50, 40, 50, 70], [85, 15, 20], 'kunming', '世镇云南。'),
  C('zhangkentang', '张肯堂', 'mingprov', '福建巡抚', [30, 60, 45, 50, 55], [88, 12, 30], 'fuzhou', '驻福州。'),
  C('zengying', '曾英', 'mingprov', '参将', [60, 30, 45, 30, 45], [88, 10, 60], 'chongqing', '川东守将。'),
  // 郑氏
  C('zhengzhilong', '郑芝龙', 'zheng', '南安伯 · 总兵', [65, 60, 75, 80, 70], [55, 55, -20], 'anping', '海商出身，受抚为明将，掌闽海船队与贸易。'),
  C('zhenghongkui', '郑鸿逵', 'zheng', '镇江总兵', [60, 40, 45, 40, 50], [70, 30, 30], 'zhenjiang', '芝龙之弟，率水师守镇江江面。'),
  C('zhengsen', '郑森', 'zheng', '国子监生', [70, 55, 70, 55, 40], [95, 0, 80], 'nanjing', '芝龙长子，时在南京国子监读书，师事钱谦益。'),
  C('zhengcai', '郑彩', 'zheng', '水师将领', [55, 35, 40, 35, 35], [55, 45, 10], 'xiamen', '郑氏族人，驻中左所。'),
  // 清
  C('fulin', '福临', 'qing', '顺治帝', [5, 5, 5, 5, 70], [100, 0, 0], 'beijing', '年方七岁。'),
  C('duoergun', '多尔衮', 'qing', '摄政王', [85, 85, 88, 80, 90], [100, 0, 70], 'beijing', '入关定鼎北京，总揽朝政。'),
  C('duoduo', '多铎', 'qing', '豫亲王', [85, 40, 60, 40, 70], [100, 0, 80], 'beijing', '多尔衮同母弟，善骑战。'),
  C('ajige', '阿济格', 'qing', '英亲王', [80, 30, 45, 30, 60], [95, 0, 80], 'beijing', '多尔衮同母兄，追击大顺。'),
  C('haoge', '豪格', 'qing', '肃亲王', [75, 40, 45, 35, 60], [80, 0, 60], 'tianjin', '皇太极长子。'),
  C('wusangui', '吴三桂', 'qing', '平西王', [80, 50, 65, 55, 60], [65, 0, 60], 'beijing', '开山海关迎清兵入关。'),
  C('hongchengchou', '洪承畴', 'qing', '内院大学士', [70, 80, 85, 80, 55], [85, 0, 30], 'beijing', '前明蓟辽总督，松锦战败降清。'),
  C('zhunta', '准塔', 'qing', '固山额真', [65, 30, 40, 30, 40], [95, 0, 60], 'tianjin', '略定山东。'),
  // 大顺
  C('lizicheng', '李自成', 'shun', '大顺皇帝', [80, 45, 55, 40, 85], [100, 0, 70], 'taiyuan', '三月破北京，四月山海关败于清与吴三桂联军，西撤。'),
  C('liuzongmin', '刘宗敏', 'shun', '汝侯', [75, 20, 30, 20, 50], [95, 0, 70], 'taiyuan', '大顺第一大将。'),
  C('liguo', '李过', 'shun', '亳侯', [72, 35, 40, 30, 50], [95, 5, 60], 'xian', '李自成之侄。'),
  C('tianjianxiu', '田见秀', 'shun', '泽侯', [60, 50, 45, 40, 55], [85, 15, 20], 'xian', '宽厚得众。'),
  C('niujinxing', '牛金星', 'shun', '丞相', [20, 60, 65, 55, 40], [70, 40, -20], 'xian', '举人出身，大顺文臣之首。'),
  C('baiwang', '白旺', 'shun', '节度使', [60, 45, 40, 30, 40], [80, 20, 40], 'xiangyang', '镇守襄阳一带。'),
  C('gaoyigong', '高一功', 'shun', '将军', [68, 40, 45, 35, 45], [90, 5, 50], 'xian', '李自成妻弟。'),
  // 张献忠部
  C('zhangxianzhong', '张献忠', 'xi', '西营八大王', [78, 25, 50, 20, 70], [100, 0, 90], 'kuizhou', '溯江入蜀，欲取成都建国。'),
  C('sunkewang', '孙可望', 'xi', '平东将军', [70, 60, 65, 50, 50], [85, 10, 60], 'kuizhou', '张献忠养子之长。'),
  C('lidingguo', '李定国', 'xi', '安西将军', [85, 55, 70, 50, 60], [90, 5, 70], 'kuizhou', '张献忠养子，善战。'),
  C('liuwenxiu', '刘文秀', 'xi', '抚南将军', [70, 50, 50, 40, 45], [88, 8, 50], 'kuizhou', '张献忠养子。'),
];
