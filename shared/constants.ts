import { Suit, Tile } from './types';

// Unicode Mapping
// Man: 🀇-🀏 (1-9)
// Pin: 🀙-🀡 (1-9)
// Sou: 🀐-🀘 (1-9)
// Winds: 🀀(E), 🀁(S), 🀂(W), 🀃(N)
// Dragons: 🀄(Red), 🀅(Green), 🀆(White)

export const TILE_DEFINITIONS: Omit<Tile, 'id'>[] = [
  // Man (Characters)
  ...Array.from({ length: 9 }, (_, i) => ({ suit: Suit.Man, value: i + 1, symbol: String.fromCodePoint(0x1F007 + i), name: `${i + 1} Character` })),
  // Pin (Dots)
  ...Array.from({ length: 9 }, (_, i) => ({ suit: Suit.Pin, value: i + 1, symbol: String.fromCodePoint(0x1F019 + i), name: `${i + 1} Dot` })),
  // Sou (Bamboo)
  ...Array.from({ length: 9 }, (_, i) => ({ suit: Suit.Sou, value: i + 1, symbol: String.fromCodePoint(0x1F010 + i), name: `${i + 1} Bamboo` })),
  // Winds
  { suit: Suit.Wind, value: 1, symbol: '🀀', name: 'East Wind' },
  { suit: Suit.Wind, value: 2, symbol: '🀁', name: 'South Wind' },
  { suit: Suit.Wind, value: 3, symbol: '🀂', name: 'West Wind' },
  { suit: Suit.Wind, value: 4, symbol: '🀃', name: 'North Wind' },
  // Dragons
  { suit: Suit.Dragon, value: 1, symbol: '🀄', name: 'Red Dragon' },
  { suit: Suit.Dragon, value: 2, symbol: '🀅', name: 'Green Dragon' },
  { suit: Suit.Dragon, value: 3, symbol: '🀆', name: 'White Dragon' },
];

export const AI_THINKING_DELAY_MS = 1000;
export const HUMAN_PLAYER = 0;
