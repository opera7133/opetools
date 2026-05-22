import type { LineData } from '../types';

export const tokaidoShinkansen: LineData = {
  id: 'tokaido-shinkansen',
  name: '東海道新幹線',
  company: 'JR東海',
  stations: [
    { id: "tokyo", name: "東京", kana: "とうきょう", romaji: "Tokyo" },
    { id: "shinagawa", name: "品川", kana: "しながわ", romaji: "Shinagawa" },
    { id: "shin-yokohama", name: "新横浜", kana: "しんよこはま", romaji: "Shin-Yokohama" },
    { id: "odawara", name: "小田原", kana: "おだわら", romaji: "Odawara" },
    { id: "atami", name: "熱海", kana: "あたみ", romaji: "Atami" },
    { id: "mishima", name: "三島", kana: "みしま", romaji: "Mishima" },
    { id: "shin-fuji", name: "新富士", kana: "しんふじ", romaji: "Shin-Fuji" },
    { id: "shizuoka", name: "静岡", kana: "しずおか", romaji: "Shizuoka" },
    { id: "kakegawa", name: "掛川", kana: "かけがわ", romaji: "Kakegawa" },
    { id: "hamamatsu", name: "浜松", kana: "はままつ", romaji: "Hamamatsu" },
    { id: "toyohashi", name: "豊橋", kana: "とよはし", romaji: "Toyohashi" },
    { id: "mikawa-anjo", name: "三河安城", kana: "みかわあんじょう", romaji: "Mikawa-Anjo" },
    { id: "nagoya", name: "名古屋", kana: "なごや", romaji: "Nagoya" },
    { id: "gifu-hashima", name: "岐阜羽島", kana: "ぎふはしま", romaji: "Gifu-Hashima" },
    { id: "maibara", name: "米原", kana: "まいばら", romaji: "Maibara" },
    { id: "kyoto", name: "京都", kana: "きょうと", romaji: "Kyoto" },
    { id: "shin-osaka", name: "新大阪", kana: "しんおおさか", romaji: "Shin-Osaka" },
  ],
  types: [
    { id: "nozomi", name: "のぞみ", color: "#e8e813", stops: {
      "tokyo": "terminal",
      "shinagawa": "stop",
      "shin-yokohama": "stop",
      "nagoya": "stop",
      "kyoto": "stop",
      "shin-osaka": "terminal"
    } },
    { id: "hikari", name: "ひかり", color: "#FF0000", stops: {
      "tokyo": "terminal",
      "shinagawa": "stop",
      "shin-yokohama": "stop",
      "odawara": {
        type: "partial",
      },
      "atami": {
        type: "partial",
      },
      "mishima": {
        type: "partial",
      },
      "shizuoka": {
        type: "mostly",
      },
      "hamamatsu": {
        type: "mostly",
      },
      "toyohashi": {
        type: "partial",
      },
      "nagoya": "stop",
      "gifu-hashima": {
        type: "mostly",
      },
      "maibara": {
        type: "mostly",
      },
      "kyoto": "stop",
      "shin-osaka": "terminal"
    } },
    { id: "kodama", name: "こだま", color: "#0000FF", stops: {
      "tokyo": "terminal",
      "shinagawa": "stop",
      "shin-yokohama": "stop",
      "odawara": "stop",
      "atami": "stop",
      "mishima": "stop",
      "shin-fuji": "stop",
      "shizuoka": "stop",
      "kakegawa": "stop",
      "hamamatsu": "stop",
      "toyohashi": "stop",
      "mikawa-anjo": "stop",
      "nagoya": "stop",
      "gifu-hashima": "stop",
      "maibara": "stop",
      "kyoto": "stop",
      "shin-osaka": "terminal"
    } },
  ],
}
