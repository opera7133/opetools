import type { LineData } from '../types';

export const tokaidoAkasaka: LineData = {
  id: 'tokaido-akasaka',
  name: '東海道線 (美濃赤坂支線)',
  company: 'JR東海',
  stations: [
    { id: 'ogaki', name: '大垣', kana: 'おおがき', romaji: 'Ogaki', code: 'CA77' },
    { id: 'arao', name: '荒尾', kana: 'あらお', romaji: 'Arao' },
    { id: 'mino-akasaka', name: '美濃赤坂', kana: 'みのあかさか', romaji: 'Mino-Akasaka' },
  ],
  types: [
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F', // Gray
      stops: {
        'ogaki': 'terminal',
        'arao': 'stop',
        'mino-akasaka': 'terminal',
      }
    }
  ]
};
