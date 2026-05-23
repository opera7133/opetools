import type { LineData } from '../types';

export const jrSangu: LineData = {
  id: 'jr-sangu',
  name: '参宮線',
  company: 'JR東海',
  stations: [
    { id: 'taki', name: '多気', kana: 'たき', romaji: 'Taki' },
    { id: 'tokida', name: '外城田', kana: 'ときだ', romaji: 'Tokida' },
    { id: 'tamaru', name: '田丸', kana: 'たまる', romaji: 'Tamaru' },
    { id: 'miyagawa', name: '宮川', kana: 'みやがわ', romaji: 'Miyagawa' },
    { id: 'yamada-kamiguchi', name: '山田上口', kana: 'やまだかみぐち', romaji: 'Yamada-Kamiguchi' },
    { id: 'ise-shi', name: '伊勢市', kana: 'いせし', romaji: 'Ise-shi' },
    { id: 'isuzugaoka', name: '五十鈴ヶ丘', kana: 'いすずがおか', romaji: 'Isuzugaoka' },
    { id: 'futaminoura', name: '二見浦', kana: 'ふたみのうら', romaji: 'Futaminoura' },
    { id: 'matsushita', name: '松下', kana: 'まつした', romaji: 'Matsushita' },
    { id: 'toba', name: '鳥羽', kana: 'とば', romaji: 'Toba' }
  ],
  types: [
    {
      id: 'rapid-mie',
      name: '快速みえ',
      color: '#FF8C00',
      stops: {
        'taki': {
          type: 'stop',
          throughTo: { lineId: 'jr-central-kisei', lineName: '紀勢線・名古屋方面' }
        },
        'tokida': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'tamaru': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'miyagawa': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'yamada-kamiguchi': {
          type: 'rare',
          remark: '一部列車のみ停車'
        },
        'ise-shi': 'stop',
        'isuzugaoka': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'futaminoura': {
          type: 'mostly',
          remark: '一部列車のみ停車'
        },
        'matsushita': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'toba': 'terminal'
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'taki': 'terminal',
        'tokida': 'stop',
        'tamaru': 'stop',
        'miyagawa': 'stop',
        'yamada-kamiguchi': 'stop',
        'ise-shi': 'stop',
        'isuzugaoka': 'stop',
        'futaminoura': 'stop',
        'matsushita': 'stop',
        'toba': 'terminal'
      }
    }
  ]
};
