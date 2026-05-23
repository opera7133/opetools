import type { LineData } from '../types';

export const jrMeisho: LineData = {
  id: 'jr-meisho',
  name: '名松線',
  company: 'JR東海',
  stations: [
    { id: 'matsusaka', name: '松阪', kana: 'まつさか', romaji: 'Matsusaka' },
    { id: 'kaminosho', name: '上ノ庄', kana: 'かみのしょう', romaji: 'Kaminosho' },
    { id: 'gongenmae', name: '権現前', kana: 'ごんげんまえ', romaji: 'Gongenmae' },
    { id: 'ise-hata', name: '伊勢八太', kana: 'いせはた', romaji: 'Ise-Hata' },
    { id: 'ichishi', name: '一志', kana: 'いちし', romaji: 'Ichishi' },
    { id: 'isegi', name: '井関', kana: 'いせぎ', romaji: 'Isegi' },
    { id: 'ise-oi', name: '伊勢大井', kana: 'いせおおい', romaji: 'Ise-Oi' },
    { id: 'ise-kawaguchi', name: '伊勢川口', kana: 'いせかわぐち', romaji: 'Ise-Kawaguchi' },
    { id: 'sekinomiya', name: '関ノ宮', kana: 'せきのみや', romaji: 'Sekinomiya' },
    { id: 'ieki', name: '家城', kana: 'いえき', romaji: 'Ieki' },
    { id: 'ise-takehara', name: '伊勢竹原', kana: 'いせたけはら', romaji: 'Ise-Takehara' },
    { id: 'ise-kamakura', name: '伊勢鎌倉', kana: 'いせかまくら', romaji: 'Ise-Kamakura' },
    { id: 'ise-yachi', name: '伊勢八知', kana: 'いせやち', romaji: 'Ise-Yachi' },
    { id: 'hitsu', name: '比津', kana: 'ひつ', romaji: 'Hitsu' },
    { id: 'ise-okitsu', name: '伊勢奥津', kana: 'いせおきつ', romaji: 'Ise-Okitsu' }
  ],
  types: [
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'matsusaka': 'terminal',
        'kaminosho': 'stop',
        'gongenmae': 'stop',
        'ise-hata': 'stop',
        'ichishi': 'stop',
        'isegi': 'stop',
        'ise-oi': 'stop',
        'ise-kawaguchi': 'stop',
        'sekinomiya': 'stop',
        'ieki': 'stop',
        'ise-takehara': 'stop',
        'ise-kamakura': 'stop',
        'ise-yachi': 'stop',
        'hitsu': 'stop',
        'ise-okitsu': 'terminal'
      }
    }
  ]
};
