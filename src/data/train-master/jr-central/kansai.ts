import type { LineData } from '../types';

export const jrCentralKansai: LineData = {
  id: 'jr-central-kansai',
  name: '関西本線',
  company: 'JR東海',
  stations: [
    { id: 'nagoya', name: '名古屋', kana: 'なごや', romaji: 'Nagoya', code: 'CJ00' },
    { id: 'hatta', name: '八田', kana: 'はった', romaji: 'Hatta', code: 'CJ01' },
    { id: 'haruta', name: '春田', kana: 'はるた', romaji: 'Haruta', code: 'CJ02' },
    { id: 'kanie', name: '蟹江', kana: 'かにえ', romaji: 'Kanie', code: 'CJ03' },
    { id: 'eiwa', name: '永和', kana: 'えいわ', romaji: 'Eiwa', code: 'CJ04' },
    { id: 'yatomi', name: '弥富', kana: 'やとみ', romaji: 'Yatomi', code: 'CJ05' },
    { id: 'nagashima', name: '長島', kana: 'ながしま', romaji: 'Nagashima', code: 'CJ06' },
    { id: 'kuwana', name: '桑名', kana: 'くわな', romaji: 'Kuwana', code: 'CJ07' },
    { id: 'asahi', name: '朝日', kana: 'あさひ', romaji: 'Asahi', code: 'CJ08' },
    { id: 'tomida', name: '富田', kana: 'とみだ', romaji: 'Tomida', code: 'CJ09' },
    { id: 'tomidahama', name: '富田浜', kana: 'とみだはま', romaji: 'Tomidahama', code: 'CJ10' },
    { id: 'yokkaichi', name: '四日市', kana: 'よっかいち', romaji: 'Yokkaichi', code: 'CJ11' },
    { id: 'minami-yokkaichi', name: '南四日市', kana: 'みなみよっかいち', romaji: 'Minami-Yokkaichi', code: 'CJ12' },
    { id: 'kawarada', name: '河原田', kana: 'かわらだ', romaji: 'Kawarada', code: 'CJ13' },
    { id: 'kasado', name: '加佐登', kana: 'かさと', romaji: 'Kasado', code: 'CJ14' },
    { id: 'idagawa', name: '井田川', kana: 'いだがわ', romaji: 'Idagawa', code: 'CJ15' },
    { id: 'kameyama', name: '亀山', kana: 'かめやま', romaji: 'Kameyama', code: 'CJ16' }
  ],
  types: [
    {
      id: 'rapid-mie',
      name: '快速みえ',
      color: '#FF8C00',
      stops: {
        'nagoya': 'terminal',
        'kuwana': 'stop',
        'yokkaichi': 'stop',
        'kawarada': {
          type: 'pass',
          throughTo: { lineId: 'ise-railway', lineName: '伊勢鉄道線方面' }
        }
      }
    },
    {
      id: 'rapid',
      name: '快速',
      color: '#0166FF',
      stops: {
        'nagoya': 'terminal',
        'kuwana': 'stop',
        'yokkaichi': 'stop',
        'minami-yokkaichi': 'stop',
        'kawarada': 'stop',
        'kasado': 'stop',
        'idagawa': 'stop',
        'kameyama': 'terminal'
      }
    },
    {
      id: 'section-rapid',
      name: '区間快速',
      color: '#2DCF2E',
      stops: {
        'nagoya': 'terminal',
        'hatta': 'stop',
        'haruta': 'stop',
        'kanie': 'stop',
        'yatomi': 'stop',
        'kuwana': 'stop',
        'asahi': 'stop',
        'tomida': 'stop',
        'tomidahama': 'stop',
        'yokkaichi': 'stop',
        'minami-yokkaichi': 'stop',
        'kawarada': 'stop',
        'kasado': 'stop',
        'idagawa': 'stop',
        'kameyama': 'terminal'
      }
    },
    {
      id: 'local',
      name: '普通',
      color: '#8A8D8F',
      stops: {
        'nagoya': 'terminal',
        'hatta': 'stop',
        'haruta': 'stop',
        'kanie': 'stop',
        'eiwa': 'stop',
        'yatomi': 'stop',
        'nagashima': 'stop',
        'kuwana': 'stop',
        'asahi': 'stop',
        'tomida': 'stop',
        'tomidahama': 'stop',
        'yokkaichi': 'stop',
        'minami-yokkaichi': 'stop',
        'kawarada': 'stop',
        'kasado': 'stop',
        'idagawa': 'stop',
        'kameyama': 'terminal'
      }
    }
  ]
};
