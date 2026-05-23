import type { LineData } from '../types';

export const jrCentralTakayama: LineData = {
  id: 'jr-central-takayama',
  name: '高山本線',
  company: 'JR東海',
  stations: [
    { id: 'gifu', name: '岐阜', kana: 'ぎふ', romaji: 'Gifu', code: 'CG00' },
    { id: 'nagamori', name: '長森', kana: 'ながもり', romaji: 'Nagamori', code: 'CG01' },
    { id: 'naka', name: '那加', kana: 'なか', romaji: 'Naka', code: 'CG02' },
    { id: 'sobara', name: '蘇原', kana: 'そばら', romaji: 'Sobara', code: 'CG03' },
    { id: 'kagamigahara', name: '各務ヶ原', kana: 'かがみがはら', romaji: 'Kagamigahara', code: 'CG04' },
    { id: 'unuma', name: '鵜沼', kana: 'うぬま', romaji: 'Unuma', code: 'CG05' },
    { id: 'sakahogi', name: '坂祝', kana: 'さかほぎ', romaji: 'Sakahogi', code: 'CG06' },
    { id: 'mino-ota', name: '美濃太田', kana: 'みのおおた', romaji: 'Mino-Ota', code: 'CG07' },
    { id: 'kobi', name: '古井', kana: 'こび', romaji: 'Kobi' },
    { id: 'naka-kawabe', name: '中川辺', kana: 'なかかわべ', romaji: 'Naka-Kawabe' },
    { id: 'shimo-aso', name: '下麻生', kana: 'しもあそう', romaji: 'Shimo-Aso' },
    { id: 'kami-aso', name: '上麻生', kana: 'かみあそう', romaji: 'Kami-Aso' },
    { id: 'shirakawaguchi', name: '白川口', kana: 'しらかわぐち', romaji: 'Shirakawaguchi' },
    { id: 'shimo-yui', name: '下油井', kana: 'しもゆい', romaji: 'Shimo-Yui' },
    { id: 'hida-kanayama', name: '飛騨金山', kana: 'ひだかなやま', romaji: 'Hida-Kanayama' },
    { id: 'yakeishi', name: '焼石', kana: 'やけいし', romaji: 'Yakeishi' },
    { id: 'gero', name: '下呂', kana: 'げろ', romaji: 'Gero', code: 'CG16' },
    { id: 'zenshoji', name: '禅昌寺', kana: 'ぜんしょうじ', romaji: 'Zenshoji' },
    { id: 'hida-hagiwara', name: '飛騨萩原', kana: 'ひだはぎわら', romaji: 'Hida-Hagiwara' },
    { id: 'joro', name: '上呂', kana: 'じょうろ', romaji: 'Joro' },
    { id: 'hida-miyada', name: '飛騨宮田', kana: 'ひだみやだ', romaji: 'Hida-Miyada' },
    { id: 'hida-osaka', name: '飛騨小坂', kana: 'ひだおさか', romaji: 'Hida-Osaka' },
    { id: 'nagisa', name: '渚', kana: 'なぎさ', romaji: 'Nagisa' },
    { id: 'kuguno', name: '久々野', kana: 'くぐの', romaji: 'Kuguno' },
    { id: 'hida-ichinomiya', name: '飛騨一ノ宮', kana: 'ひだいちのみや', romaji: 'Hida-Ichinomiya' },
    { id: 'takayama', name: '高山', kana: 'たかやま', romaji: 'Takayama', code: 'CG25' },
    { id: 'hozue', name: '上枝', kana: 'ほずえ', romaji: 'Hozue' },
    { id: 'hida-kokufu', name: '飛騨国府', kana: 'ひだこくふ', romaji: 'Hida-Kokufu' },
    { id: 'hida-furukawa', name: '飛騨古川', kana: 'ひだふるかわ', romaji: 'Hida-Furukawa', code: 'CG28' },
    { id: 'sugisaki', name: '杉崎', kana: 'すぎさき', romaji: 'Sugisaki' },
    { id: 'hida-hosoe', name: '飛騨細江', kana: 'ひだほそえ', romaji: 'Hida-Hosoe' },
    { id: 'tsunogawa', name: '角川', kana: 'つのがわ', romaji: 'Tsunogawa' },
    { id: 'sakakami', name: '坂上', kana: 'さかかみ', romaji: 'Sakakami' },
    { id: 'utsubo', name: '打保', kana: 'うつぼ', romaji: 'Utsubo' },
    { id: 'sugihara', name: '杉原', kana: 'すぎはら', romaji: 'Sugihara' },
    { id: 'inotani', name: '猪谷', kana: 'いのたに', romaji: 'Inotani' }
  ],
  types: [
    {
      id: 'ltd-exp-hida',
      name: '特急ひだ',
      color: '#EE6D01',
      stops: {
        'gifu': {
          type: 'stop',
          throughTo: { lineId: 'tokaido-nagoya', lineName: '東海道線・名古屋方面' }
        },
        'unuma': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'mino-ota': 'stop',
        'shirakawaguchi': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'hida-kanayama': {
          type: 'mostly',
          remark: '一部列車のみ停車'
        },
        'gero': 'stop',
        'hida-hagiwara': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'hida-osaka': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'kuguno': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'takayama': 'stop',
        'hida-furukawa': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'inotani': {
          type: 'partial',
          remark: '一部列車のみ停車',
          throughTo: { lineId: 'jr-west-takayama', lineName: '高山本線・富山方面' }
        },
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'gifu': 'terminal',
        'nagamori': 'stop',
        'naka': 'stop',
        'sobara': 'stop',
        'kagamigahara': 'stop',
        'unuma': 'stop',
        'mino-ota': 'stop',
        'kobi': 'stop',
        'naka-kawabe': 'stop',
        'shimo-aso': 'stop',
        'kami-aso': 'stop',
        'shirakawaguchi': 'stop',
        'shimo-yui': 'stop',
        'hida-kanayama': 'stop',
        'yakeishi': 'stop',
        'gero': 'stop',
        'zenshoji': 'stop',
        'hida-hagiwara': 'stop',
        'joro': 'stop',
        'hida-miyada': 'stop',
        'hida-osaka': 'stop',
        'nagisa': 'stop',
        'kuguno': 'stop',
        'hida-ichinomiya': 'stop',
        'takayama': 'stop',
        'hozue': 'stop',
        'hida-kokufu': 'stop',
        'hida-furukawa': 'stop',
        'sugisaki': 'stop',
        'hida-hosoe': 'stop',
        'tsunogawa': 'stop',
        'sakakami': 'stop',
        'utsubo': 'stop',
        'sugihara': 'stop',
        'inotani': 'terminal'
      }
    }
  ]
};
