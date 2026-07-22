export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface PlayerProfile {
  name: string;
  xp: number;
  coins: number;
  level: number;
  unlockedTerritories: string[];
  completedMissions: string[];
}

export type GameState = 'MAP' | 'EXPEDITION' | 'BATTLE' | 'PASSPORT';
