export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface PlayerProfile {
  name: string;
  avatar: string;
  xp: number;
  coins: number;
  level: number;
  unlockedTerritories: string[];
  completedMissions: string[];
  adventureXp: Record<string, number>;
}

export type GameState = 'MAP' | 'EXPEDITION' | 'BATTLE' | 'PASSPORT';
