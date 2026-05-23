import type { LineData } from '../types';

export const jrTaketoyo: LineData = {
  id: 'jr-taketoyo',
  name: '武豊線',
  company: 'JR東海',
  stations: [
    { id: 'obu', name: '大府', kana: 'おおぶ', romaji: 'Obu', code: 'CE00' },
    { id: 'owari-morioka', name: '尾張森岡', kana: 'おわりもりおか', romaji: 'Owari-Morioka', code: 'CE01' },
    { id: 'ogawa', name: '緒川', kana: 'おがわ', romaji: 'Ogawa', code: 'CE02' },
    { id: 'ishihama', name: '石浜', kana: 'いしはま', romaji: 'Ishihama', code: 'CE03' },
    { id: 'higashiura', name: '東浦', kana: 'ひがしうら', romaji: 'Higashiura', code: 'CE04' },
    { id: 'kamezaki', name: '亀崎', kana: 'かめざき', romaji: 'Kamezaki', code: 'CE05' },
    { id: 'okkawa', name: '乙川', kana: 'おっかわ', romaji: 'Okkawa', code: 'CE06' },
    { id: 'handa', name: '半田', kana: 'はんだ', romaji: 'Handa', code: 'CE07' },
    { id: 'higashi-narawa', name: '東成岩', kana: 'ひがしならわ', romaji: 'Higashi-Narawa', code: 'CE08' },
    { id: 'taketoyo', name: '武豊', kana: 'たけとよ', romaji: 'Taketoyo', code: 'CE09' }
  ],
  types: [
    {
      id: 'section-rapid',
      name: '区間快速',
      color: '#2DCF2E',
      stops: {
        'obu': {
          type: 'terminal',
          throughTo: { lineId: 'tokaido-nagoya', lineName: '東海道線方面' }
        },
        'owari-morioka': 'stop',
        'ogawa': 'stop',
        'ishihama': 'stop',
        'higashiura': 'stop',
        'kamezaki': 'stop',
        'okkawa': 'stop',
        'handa': 'stop',
        'higashi-narawa': 'stop',
        'taketoyo': 'terminal'
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'obu': {
          type: 'terminal',
          throughTo: { lineId: 'tokaido-nagoya', lineName: '東海道線方面' }
        },
        'owari-morioka': 'stop',
        'ogawa': 'stop',
        'ishihama': 'stop',
        'higashiura': 'stop',
        'kamezaki': 'stop',
        'okkawa': 'stop',
        'handa': 'stop',
        'higashi-narawa': 'stop',
        'taketoyo': 'terminal'
      }
    }
  ]
};
