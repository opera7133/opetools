import type { LineData } from '../types';

export const jrTaita: LineData = {
  id: 'jr-taita',
  name: '太多線',
  company: 'JR東海',
  stations: [
    { id: 'mino-ota', name: '美濃太田', kana: 'みのおおた', romaji: 'Mino-Ota', code: 'CI00' },
    { id: 'mino-kawai', name: '美濃河合', kana: 'みのかわい', romaji: 'Mino-Kawai', code: 'CI01' },
    { id: 'kani', name: '可児', kana: 'かに', romaji: 'Kani', code: 'CI02' },
    { id: 'shimogiri', name: '下切', kana: 'しもぎり', romaji: 'Shimogiri', code: 'CI03' },
    { id: 'hime', name: '姫', kana: 'ひめ', romaji: 'Hime', code: 'CI04' },
    { id: 'nemoto', name: '根本', kana: 'ねもと', romaji: 'Nemoto', code: 'CI05' },
    { id: 'koizumi', name: '小泉', kana: 'こいずみ', romaji: 'Koizumi', code: 'CI06' },
    { id: 'tajimi', name: '多治見', kana: 'たじみ', romaji: 'Tajimi', code: 'CI07' }
  ],
  types: [
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'mino-ota': 'terminal',
        'mino-kawai': 'stop',
        'kani': 'stop',
        'shimogiri': 'stop',
        'hime': 'stop',
        'nemoto': 'stop',
        'koizumi': 'stop',
        'tajimi': 'terminal'
      }
    }
  ]
};
