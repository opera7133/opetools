import type { LineData } from '../types';

export const jrCentralChuo: LineData = {
  id: 'jr-central-chuo',
  name: '中央線',
  company: 'JR東海',
  stations: [
    { id: 'nagoya', name: '名古屋', kana: 'なごや', romaji: 'Nagoya', code: 'CF00' },
    { id: 'kanayama', name: '金山', kana: 'かなやま', romaji: 'Kanayama', code: 'CF01' },
    { id: 'tsurumai', name: '鶴舞', kana: 'つるまい', romaji: 'Tsurumai', code: 'CF02' },
    { id: 'chikusa', name: '千種', kana: 'ちくさ', romaji: 'Chikusa', code: 'CF03' },
    { id: 'ozone', name: '大曽根', kana: 'おおぞね', romaji: 'Ozone', code: 'CF04' },
    { id: 'shin-moriyama', name: '新守山', kana: 'しんもりやま', romaji: 'Shin-Moriyama', code: 'CF05' },
    { id: 'kachigawa', name: '勝川', kana: 'かちがわ', romaji: 'Kachigawa', code: 'CF06' },
    { id: 'kasugai', name: '春日井', kana: 'かすがい', romaji: 'Kasugai', code: 'CF07' },
    { id: 'jinryo', name: '神領', kana: 'じんりょう', romaji: 'Jinryo', code: 'CF08' },
    { id: 'kozoji', name: '高蔵寺', kana: 'こうぞうじ', romaji: 'Kozoji', code: 'CF09' },
    { id: 'jokoji', name: '定光寺', kana: 'じょうこうじ', romaji: 'Jokoji', code: 'CF10' },
    { id: 'kokokei', name: '古虎渓', kana: 'ここけい', romaji: 'Kokokei', code: 'CF11' },
    { id: 'tajimi', name: '多治見', kana: 'たじみ', romaji: 'Tajimi', code: 'CF12' },
    { id: 'tokishi', name: '土岐市', kana: 'ときし', romaji: 'Tokishi', code: 'CF13' },
    { id: 'mizunami', name: '瑞浪', kana: 'みずなみ', romaji: 'Mizunami', code: 'CF14' },
    { id: 'kamado', name: '釜戸', kana: 'かまど', romaji: 'Kamado', code: 'CF15' },
    { id: 'takenami', name: '武並', kana: 'たけなみ', romaji: 'Takenami', code: 'CF16' },
    { id: 'ena', name: '恵那', kana: 'えな', romaji: 'Ena', code: 'CF17' },
    { id: 'minosakamoto', name: '美乃坂本', kana: 'みのさかもと', romaji: 'Minosakamoto', code: 'CF18' },
    { id: 'nakatsugawa', name: '中津川', kana: 'なかつがわ', romaji: 'Nakatsugawa', code: 'CF19' },
    { id: 'ochiagawa', name: '落合川', kana: 'おちあいがわ', romaji: 'Ochiagawa' },
    { id: 'sakashita', name: '坂下', kana: 'さかした', romaji: 'Sakashita' },
    { id: 'tadachi', name: '田立', kana: 'ただち', romaji: 'Tadachi' },
    { id: 'nagiso', name: '南木曽', kana: 'なぎそ', romaji: 'Nagiso', code: 'CF23' },
    { id: 'junikane', name: '十二兼', kana: 'じゅうにかね', romaji: 'Junikane' },
    { id: 'nojiri', name: '野尻', kana: 'のじり', romaji: 'Nojiri' },
    { id: 'okuwa', name: '大桑', kana: 'おおくわ', romaji: 'Okuwa' },
    { id: 'suhara', name: '須原', kana: 'すら', romaji: 'Suhara' },
    { id: 'kuramoto', name: '倉本', kana: 'くらもと', romaji: 'Kuramoto' },
    { id: 'agematsu', name: '上松', kana: 'あげまつ', romaji: 'Agematsu', code: 'CF29' },
    { id: 'kiso-fukushima', name: '木曽福島', kana: 'きそふくしま', romaji: 'Kiso-Fukushima', code: 'CF30' },
    { id: 'harano', name: '原野', kana: 'はらの', romaji: 'Harano' },
    { id: 'miyanokoshi', name: '宮ノ越', kana: 'みやのこし', romaji: 'Miyanokoshi' },
    { id: 'yabuhara', name: '藪原', kana: 'やぶはら', romaji: 'Yabuhara' },
    { id: 'narai', name: '奈良井', kana: 'ならい', romaji: 'Narai' },
    { id: 'kiso-hirasawa', name: '木曽平沢', kana: 'きそひらさわ', romaji: 'Kiso-Hirasawa' },
    { id: 'niekawa', name: '贄川', kana: 'にえかわ', romaji: 'Niekawa' },
    { id: 'hideshio', name: '日出塩', kana: 'ひでしお', romaji: 'Hideshio' },
    { id: 'seba', name: '洗馬', kana: 'せば', romaji: 'Seba' },
    { id: 'shiojiri', name: '塩尻', kana: 'しおじり', romaji: 'Shiojiri' },
  ],
  types: [
    {
      id: 'exp-shinano',
      name: '特急しなの',
      color: '#EE6D01',
      stops: {
        'nagoya': 'terminal',
        'kanayama': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'chikusa': 'stop',
        'tajimi': 'stop',
        'ena': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'nakatsugawa': 'stop',
        'nagiso': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'agematsu': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'kiso-fukushima': 'stop',
        'shiojiri': {
          type: 'terminal',
          throughTo: {
            lineId: 'jr-east-shinonoi',
            lineName: '信濃大町・松本方面'
          }
        }
      }
    },
    {
      id: 'rapid',
      name: '快速',
      color: '#1E90FF', // Blue
      stops: {
        'nagoya': 'terminal',
        'kanayama': 'stop',
        'tsurumai': 'stop',
        'chikusa': 'stop',
        'ozone': 'stop',
        'kachigawa': 'stop',
        'kasugai': 'stop',
        'kozoji': 'stop',
        'tajimi': 'stop',
        'tokishi': 'stop',
        'mizunami': 'stop',
        'kamado': 'stop',
        'takenami': 'stop',
        'ena': 'stop',
        'minosakamoto': 'stop',
        'nakatsugawa': 'terminal',
      }
    },
    {
      id: 'semi-rapid',
      name: '区間快速',
      color: '#009944', // Green
      stops: {
        'nagoya': 'terminal',
        'kanayama': 'stop',
        'tsurumai': 'stop',
        'chikusa': 'stop',
        'ozone': 'stop',
        'shin-moriyama': 'stop',
        'kachigawa': 'stop',
        'kasugai': 'stop',
        'jinryo': 'stop',
        'kozoji': 'stop',
        'tajimi': 'stop',
        'tokishi': 'stop',
        'mizunami': 'stop',
        'kamado': 'stop',
        'takenami': 'stop',
        'ena': 'stop',
        'minosakamoto': 'stop',
        'nakatsugawa': 'terminal',
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F', // Gray
      stops: {
        'nagoya': 'terminal',
        'kanayama': 'stop',
        'tsurumai': 'stop',
        'chikusa': 'stop',
        'ozone': 'stop',
        'shin-moriyama': 'stop',
        'kachigawa': 'stop',
        'kasugai': 'stop',
        'jinryo': 'stop',
        'kozoji': 'stop',
        'jokoji': 'stop',
        'kokokei': 'stop',
        'tajimi': 'stop',
        'tokishi': 'stop',
        'mizunami': 'stop',
        'kamado': 'stop',
        'takenami': 'stop',
        'ena': 'stop',
        'minosakamoto': 'stop',
        'nakatsugawa': 'stop',
        'ochiagawa': 'stop',
        'sakashita': 'stop',
        'tadachi': 'stop',
        'nagiso': 'stop',
        'junikane': 'stop',
        'nojiri': 'stop',
        'okuwa': 'stop',
        'suhara': 'stop',
        'kuramoto': 'stop',
        'agematsu': 'stop',
        'kiso-fukushima': 'stop',
        'harano': 'stop',
        'miyanokoshi': 'stop',
        'yabuhara': 'stop',
        'narai': 'stop',
        'kiso-hirasawa': 'stop',
        'niekawa': 'stop',
        'hideshio': 'stop',
        'seba': 'stop',
        'shiojiri': 'terminal',
      }
    }
  ]
};
