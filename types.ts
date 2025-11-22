export enum Suit {
  Man = 'Man', // Characters
  Pin = 'Pin', // Dots
  Sou = 'Sou', // Bamboo
  Wind = 'Wind',
  Dragon = 'Dragon'
}

export interface Tile {
  id: string;
  suit: Suit;
  value: number;
  symbol: string;
  name: string;
}

export enum Player {
  Bottom = 0, // Human
  Right = 1,
  Top = 2,
  Left = 3
}

export enum GamePhase {
  Draw,      // Active player draws a tile
  Discard,   // Active player discards a tile
  Action,    // Other players decide to Chi/Pong/Kong/Hu/Pass on the discard
  GameOver
}

export enum ActionType {
  Chi = 'Chi',
  Pong = 'Pong',
  Kong = 'Kong', // Exposed Kong (from discard)
  AnKong = 'AnKong', // Concealed Kong (self draw 4)
  BuKong = 'BuKong', // Added Kong (meld pong + self draw)
  Hu = 'Hu',
  Pass = 'Pass'
}

export interface Meld {
  type: ActionType;
  tiles: Tile[];
}

export interface GameState {
  deck: Tile[];
  players: {
    [key in Player]: Tile[];
  };
  melds: {
    [key in Player]: Meld[];
  };
  discards: {
    [key in Player]: Tile[];
  };
  currentPlayer: Player;
  phase: GamePhase;
  winner: Player | null;
  lastDrawnTile: Tile | null;
  lastDiscardedTile: { tile: Tile; fromPlayer: Player } | null;
  turnCount: number;
  availableActions: ActionType[]; // Actions available to the human player currently
}