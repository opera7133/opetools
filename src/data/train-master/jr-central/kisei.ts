import type { LineData } from '../types';

export const jrCentralKisei: LineData = {
  id: 'jr-central-kisei',
  name: '紀勢本線',
  company: 'JR東海',
  stations: [
    { id: 'kameyama', name: '亀山', kana: 'かめやま', romaji: 'Kameyama' },
    { id: 'shimonosho', name: '下庄', kana: 'しもののしょう', romaji: 'Shimonosho' },
    { id: 'ishinden', name: '一身田', kana: 'いしんでん', romaji: 'Ishinden' },
    { id: 'tsu', name: '津', kana: 'つ', romaji: 'Tsu' },
    { id: 'akogi', name: '阿漕', kana: 'あこぎ', romaji: 'Akogi' },
    { id: 'takachaya', name: '高茶屋', kana: 'たかちゃや', romaji: 'Takachaya' },
    { id: 'rokken', name: '六軒', kana: 'ろっけん', romaji: 'Rokken' },
    { id: 'matsusaka', name: '松阪', kana: 'まつさか', romaji: 'Matsusaka' },
    { id: 'tokuwa', name: '徳和', kana: 'とくわ', romaji: 'Tokuwa' },
    { id: 'taki', name: '多気', kana: 'たき', romaji: 'Taki' },
    { id: 'oka', name: '相可', kana: 'おうか', romaji: 'Oka' },
    { id: 'sana', name: '佐奈', kana: 'さな', romaji: 'Sana' },
    { id: 'tochihara', name: '栃原', kana: 'とちはら', romaji: 'Tochihara' },
    { id: 'kawazoe', name: '川添', kana: 'かわぞえ', romaji: 'Kawazoe' },
    { id: 'misedani', name: '三瀬谷', kana: 'みせだに', romaji: 'Misedani' },
    { id: 'takihara', name: '滝原', kana: 'たきはら', romaji: 'Takihara' },
    { id: 'aso', name: '阿曽', kana: 'あそ', romaji: 'Aso' },
    { id: 'ise-kashiwazaki', name: '伊勢柏崎', kana: 'いせかしわざき', romaji: 'Ise-Kashiwazaki' },
    { id: 'ouchiyama', name: '大内山', kana: 'おうちやま', romaji: 'Ouchiyama' },
    { id: 'umegadani', name: '梅ケ谷', kana: 'うめがだに', romaji: 'Umegadani' },
    { id: 'kii-nagashima', name: '紀伊長島', kana: 'きいながしま', romaji: 'Kii-Nagashima' },
    { id: 'minose', name: '三野瀬', kana: 'みのせ', romaji: 'Minose' },
    { id: 'funatsu', name: '船津', kana: 'ふなつ', romaji: 'Funatsu' },
    { id: 'aiga', name: '相賀', kana: 'あいが', romaji: 'Aiga' },
    { id: 'owase', name: '尾鷲', kana: 'おわせ', romaji: 'Owase' },
    { id: 'osoneura', name: '大曽根浦', kana: 'おおそねうら', romaji: 'Osoneura' },
    { id: 'kuki', name: '九鬼', kana: 'くき', romaji: 'Kuki' },
    { id: 'mikisato', name: '三木里', kana: 'みきさと', romaji: 'Mikisato' },
    { id: 'kata', name: '賀田', kana: 'かた', romaji: 'Kata' },
    { id: 'nigishima', name: '二木島', kana: 'にぎしま', romaji: 'Nigishima' },
    { id: 'atashika', name: '新鹿', kana: 'あたしか', romaji: 'Atashika' },
    { id: 'hadasu', name: '波田須', kana: 'はだす', romaji: 'Hadasu' },
    { id: 'odomari', name: '大泊', kana: 'おおどまり', romaji: 'Odomari' },
    { id: 'kumanoshi', name: '熊野市', kana: 'くまのし', romaji: 'Kumanoshi' },
    { id: 'arii', name: '有井', kana: 'ありい', romaji: 'Arii' },
    { id: 'koshiyama', name: '神志山', kana: 'こうしやま', romaji: 'Koshiyama' },
    { id: 'kii-ichigi', name: '紀伊市木', kana: 'きいいちぎ', romaji: 'Kii-Ichigi' },
    { id: 'atawa', name: '阿田和', kana: 'あたわ', romaji: 'Atawa' },
    { id: 'kii-ida', name: '紀伊井田', kana: 'きいいだ', romaji: 'Kii-Ida' },
    { id: 'udono', name: '鵜殿', kana: 'うどの', romaji: 'Udono' },
    { id: 'shingu', name: '新宮', kana: 'しんぐう', romaji: 'Shingu' }
  ],
  types: [
    {
      id: 'ltd-exp-nanki',
      name: '特急南紀',
      color: '#EE6D01',
      stops: {
        'tsu': {
          type: 'stop',
          throughTo: { lineId: 'ise-railway', lineName: '伊勢鉄道・名古屋方面' }
        },
        'matsusaka': 'stop',
        'taki': 'stop',
        'misedani': {
          type: 'partial',
          remark: '一部列車のみ停車'
        },
        'kii-nagashima': 'stop',
        'owase': 'stop',
        'kumanoshi': 'stop',
        'shingu': {
          type: 'stop',
          throughTo: { lineId: 'jr-west-kisei', lineName: '紀勢線・紀伊勝浦方面' }
        }
      }
    },
    {
      id: 'rapid-mie',
      name: '快速みえ',
      color: '#FF8C00',
      stops: {
        'tsu': {
          type: 'stop',
          throughTo: { lineId: 'ise-railway', lineName: '伊勢鉄道・名古屋方面' }
        },
        'matsusaka': 'stop',
        'taki': {
          type: 'stop',
          throughTo: { lineId: 'jr-sangu', lineName: '参宮線・鳥羽方面' }
        }
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'kameyama': 'terminal',
        'shimonosho': 'stop',
        'ishinden': 'stop',
        'tsu': 'stop',
        'akogi': 'stop',
        'takachaya': 'stop',
        'rokken': 'stop',
        'matsusaka': 'stop',
        'tokuwa': 'stop',
        'taki': 'stop',
        'oka': 'stop',
        'sana': 'stop',
        'tochihara': 'stop',
        'kawazoe': 'stop',
        'misedani': 'stop',
        'takihara': 'stop',
        'aso': 'stop',
        'ise-kashiwazaki': 'stop',
        'ouchiyama': 'stop',
        'umegadani': 'stop',
        'kii-nagashima': 'stop',
        'minose': 'stop',
        'funatsu': 'stop',
        'aiga': 'stop',
        'owase': 'stop',
        'osoneura': 'stop',
        'kuki': 'stop',
        'mikisato': 'stop',
        'kata': 'stop',
        'nigishima': 'stop',
        'atashika': 'stop',
        'hadasu': 'stop',
        'odomari': 'stop',
        'kumanoshi': 'stop',
        'arii': 'stop',
        'koshiyama': 'stop',
        'kii-ichigi': 'stop',
        'atawa': 'stop',
        'kii-ida': 'stop',
        'udono': 'stop',
        'shingu': 'terminal'
      }
    }
  ]
};
