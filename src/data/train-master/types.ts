export type StopType = 
  | 'stop'     // 停車
  | 'pass'     // 通過
  | 'terminal' // 始発・終着駅
  | 'mostly'   // 一部停車（多：多くの列車が停車）
  | 'partial'  // 一部停車（中：一部の列車が停車）
  | 'rare';    // 一部停車（少：ごく一部の列車のみ停車）

export interface ThroughService {
  lineId: string;   // 直通先路線ID
  lineName: string; // 直通先路線名
}

export interface StopConfig {
  type: StopType;
  remark?: string;       // 注記 (例: "朝のみ停車")
  throughTo?: ThroughService; // 直通先路線情報
}

export type StopPattern = StopType | StopConfig;

export interface Station {
  id: string;        // 駅ID (例: 'toyohashi')
  name: string;      // 駅名 (例: '豊橋')
  kana: string;      // かな (例: 'とよはし')
  romaji: string;    // ローマ字 (例: 'Toyohashi')
  code?: string;     // 駅ナンバリング (例: 'NH01')
}

export interface TrainType {
  id: string;        // 種別ID (例: 'local', 'express')
  name: string;      // 種別名 (例: '普通', '急行')
  color: string;     // テーマカラー (例: '#ff0000')
  textColor?: string;// 文字色 (デフォルトは白など)
  // 駅IDから停車パターンへのマップ。指定がない場合は 'pass' (通過) とみなす
  stops: Record<string, StopPattern>;
}

export interface LineData {
  id: string;          // 路線ID (例: 'meitetsu-nagoya')
  name: string;        // 路線名 (例: '名鉄名古屋本線')
  company: string;     // 会社名 (例: '名古屋鉄道')
  stations: Station[]; // 駅一覧 (起点から終点へ)
  types: TrainType[];  // 列車種別一覧
}
