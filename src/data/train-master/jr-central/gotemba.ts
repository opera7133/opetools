import type { LineData } from '../types';

export const jrGotemba: LineData = {
  id: 'jr-gotemba',
  name: '御殿場線',
  company: 'JR東海',
  stations: [
    { id: 'kozu', name: '国府津', kana: 'こうづ', romaji: 'Kozu', code: 'CB00' },
    { id: 'shimosoga', name: '下曽我', kana: 'しもそが', romaji: 'Shimosoga', code: 'CB01' },
    { id: 'kami-oi', name: '上大井', kana: 'かみおおい', romaji: 'Kami-Oi', code: 'CB02' },
    { id: 'sagami-kaneko', name: '相模金子', kana: 'さがみかねこ', romaji: 'Sagami-Kaneko', code: 'CB03' },
    { id: 'matsuda', name: '松田', kana: 'まつだ', romaji: 'Matsuda', code: 'CB04' },
    { id: 'higashi-yamakita', name: '東山北', kana: 'ひがしやまきた', romaji: 'Higashi-Yamakita', code: 'CB05' },
    { id: 'yamakita', name: '山北', kana: 'やまきた', romaji: 'Yamakita', code: 'CB06' },
    { id: 'yaga', name: '谷峨', kana: 'やが', romaji: 'Yaga', code: 'CB07' },
    { id: 'suruga-oyama', name: '駿河小山', kana: 'するがおやま', romaji: 'Suruga-Oyama', code: 'CB08' },
    { id: 'ashigara', name: '足柄', kana: 'あしがら', romaji: 'Ashigara', code: 'CB09' },
    { id: 'gotemba', name: '御殿場', kana: 'ごてんば', romaji: 'Gotemba', code: 'CB10' },
    { id: 'minami-gotemba', name: '南御殿場', kana: 'みなみごてんば', romaji: 'Minami-Gotemba', code: 'CB11' },
    { id: 'fujioka', name: '富士岡', kana: 'ふじおか', romaji: 'Fujioka', code: 'CB12' },
    { id: 'iwanami', name: '岩波', kana: 'いわなみ', romaji: 'Iwanami', code: 'CB13' },
    { id: 'susono', name: '裾野', kana: 'すその', romaji: 'Susono', code: 'CB14' },
    { id: 'nagaizuminameri', name: '長泉なめり', kana: 'ながいずみなめり', romaji: 'Nagaizumi-Nameri', code: 'CB15' },
    { id: 'shimo-togari', name: '下土狩', kana: 'しもとがり', romaji: 'Shimo-Togari', code: 'CB16' },
    { id: 'o-oka', name: '大岡', kana: 'おおおか', romaji: 'O-oka', code: 'CB17' },
    { id: 'numazu', name: '沼津', kana: 'ぬまづ', romaji: 'Numazu', code: 'CB18' }
  ],
  types: [
    {
      id: 'ltd-exp-fujisan',
      name: '特急ふじさん',
      color: '#FF8C00',
      stops: {
        'matsuda': {
          type: 'terminal',
          throughTo: { lineId: 'odakyu-odawara', lineName: '小田急線方面' }
        },
        'suruga-oyama': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'gotemba': 'terminal'
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'kozu': 'terminal',
        'shimosoga': 'stop',
        'kami-oi': 'stop',
        'sagami-kaneko': 'stop',
        'matsuda': 'stop',
        'higashi-yamakita': 'stop',
        'yamakita': 'stop',
        'yaga': 'stop',
        'suruga-oyama': 'stop',
        'ashigara': 'stop',
        'gotemba': 'stop',
        'minami-gotemba': 'stop',
        'fujioka': 'stop',
        'iwanami': 'stop',
        'susono': 'stop',
        'nagaizuminameri': 'stop',
        'shimo-togari': 'stop',
        'o-oka': 'stop',
        'numazu': {
          type: 'terminal',
          throughTo: { lineId: 'jr-tokaido-shizuoka', lineName: '東海道線方面' }
        },
      }
    }
  ]
};
