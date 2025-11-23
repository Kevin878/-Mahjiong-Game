import { Tile, Suit, Player, ActionType, Meld } from '../types';
import { TILE_DEFINITIONS } from '../constants';

export const generateDeck = (): Tile[] => {
  let deck: Tile[] = [];
  let idCounter = 0;
  
  TILE_DEFINITIONS.forEach(def => {
    for (let i = 0; i < 4; i++) {
      deck.push({
        ...def,
        id: `tile-${idCounter++}-${def.suit}-${def.value}`
      });
    }
  });
  
  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: Tile[]): Tile[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const sortHand = (hand: Tile[]): Tile[] => {
  const suitOrder = { [Suit.Man]: 1, [Suit.Pin]: 2, [Suit.Sou]: 3, [Suit.Wind]: 4, [Suit.Dragon]: 5 };
  
  return [...hand].sort((a, b) => {
    if (a.suit !== b.suit) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return a.value - b.value;
  });
};

// --- Interaction Logic ---

export const canPong = (hand: Tile[], tile: Tile): boolean => {
  const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
  return count >= 2;
};

export const canKong = (hand: Tile[], tile: Tile): boolean => {
  const count = hand.filter(t => t.suit === tile.suit && t.value === tile.value).length;
  return count === 3;
};

// Check for Concealed Kong (4 matching tiles in hand)
export const getPossibleAnKongs = (hand: Tile[]): Tile[] => {
  const counts: Record<string, Tile[]> = {};
  hand.forEach(t => {
    const key = `${t.suit}-${t.value}`;
    if (!counts[key]) counts[key] = [];
    counts[key].push(t);
  });
  
  return Object.values(counts)
    .filter(tiles => tiles.length === 4)
    .map(tiles => tiles[0]);
};

// Check for Added Kong (Tile in hand matches existing Pong meld)
export const getPossibleBuKongs = (hand: Tile[], melds: Meld[]): Tile[] => {
  const pongMelds = melds.filter(m => m.type === ActionType.Pong);
  const possible: Tile[] = [];
  
  pongMelds.forEach(meld => {
    const sample = meld.tiles[0];
    const matchInHand = hand.find(t => t.suit === sample.suit && t.value === sample.value);
    if (matchInHand) {
      possible.push(matchInHand);
    }
  });
  
  return possible;
};

// Chi only allowed from the player to the left (index - 1 or +3 % 4)
export const canChi = (hand: Tile[], tile: Tile): Tile[][] => {
  if (tile.suit === Suit.Wind || tile.suit === Suit.Dragon) return [];
  
  const options: Tile[][] = [];
  // Check for sequence x-2, x-1, [x]
  const m2 = hand.find(t => t.suit === tile.suit && t.value === tile.value - 2);
  const m1 = hand.find(t => t.suit === tile.suit && t.value === tile.value - 1);
  if (m2 && m1) options.push([m2, m1]);

  // Check for sequence x-1, [x], x+1
  const c1 = hand.find(t => t.suit === tile.suit && t.value === tile.value - 1);
  const p1 = hand.find(t => t.suit === tile.suit && t.value === tile.value + 1);
  if (c1 && p1) options.push([c1, p1]);

  // Check for sequence [x], x+1, x+2
  const p2 = hand.find(t => t.suit === tile.suit && t.value === tile.value + 2);
  // We already found p1 above if it exists
  if (p1 && p2) options.push([p1, p2]);

  return options; // Returns array of possible pairs to complete the sequence
};

// Simplified Win Check (Taiwan Mahjong: 5 sets + 1 pair for 17 tiles)
export const checkWin = (hand: Tile[], melds: Meld[] = [], extraTile?: Tile): boolean => {
  const fullHand = extraTile ? [...hand, extraTile] : [...hand];
  
  // 1. Eight Pairs check (only if no melds) for 16 tiles + 1 = 17 tiles?
  // Actually standard 7 pairs is for 13 tiles. Taiwan uses standard set mostly. 
  // There is "Nigu Nigu" (8 pairs) but let's stick to standard 5 sets + 1 pair.
  // If hand length is 17 and no melds, check for 8 pairs.
  if (melds.length === 0 && fullHand.length === 17) {
      const counts: Record<string, number> = {};
      fullHand.forEach(t => {
          const key = `${t.suit}-${t.value}`;
          counts[key] = (counts[key] || 0) + 1;
      });
      const pairs = Object.values(counts).filter(c => c === 2).length;
      // Special case: 4 identical tiles can count as 2 pairs in some rules, 
      // but strictly 8 unique pairs or 4-card groups usually form sets.
      // Let's keep it simple: strict pairs.
      if (pairs === 8) return true; // Technically possible
  }

  // 2. Standard 5 sets + 1 pair (Recursive)
  // Taiwan Mahjong hand size is 16. Winning hand size is 17.
  // Total sets needed: 5 sets (3*5 = 15) + 1 pair (2) = 17.
  
  const sorted = sortHand(fullHand);
  const setsNeeded = 5 - melds.length;
  
  return canFormSets(sorted, setsNeeded, false);
};

// Recursive backtracking to find sets
const canFormSets = (tiles: Tile[], setsNeeded: number, hasPair: boolean): boolean => {
  if (tiles.length === 0) return setsNeeded === 0 && hasPair;

  // Try to find a pair first if we don't have one
  if (!hasPair) {
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i].suit === tiles[i+1].suit && tiles[i].value === tiles[i+1].value) {
        const remaining = [...tiles];
        remaining.splice(i, 2);
        if (canFormSets(remaining, setsNeeded, true)) return true;
      }
    }
  }

  // Try to find a Triplet (Pong)
  if (setsNeeded > 0 && tiles.length >= 3) {
     if (tiles[0].suit === tiles[1].suit && tiles[1].suit === tiles[2].suit &&
         tiles[0].value === tiles[1].value && tiles[1].value === tiles[2].value) {
        const remaining = [...tiles];
        remaining.splice(0, 3);
        if (canFormSets(remaining, setsNeeded - 1, hasPair)) return true;
     }
  }

  // Try to find a Sequence (Chi) - simplified for sorted array
  if (setsNeeded > 0 && tiles.length >= 3) {
    const first = tiles[0];
    if (first.suit !== Suit.Wind && first.suit !== Suit.Dragon) {
       const secondIdx = tiles.findIndex(t => t.suit === first.suit && t.value === first.value + 1);
       const thirdIdx = tiles.findIndex(t => t.suit === first.suit && t.value === first.value + 2);
       
       if (secondIdx !== -1 && thirdIdx !== -1) {
         const remaining = [...tiles];
         // Remove specifically these indices (careful with shifting indices)
         const t1 = remaining[0];
         const t2 = remaining[secondIdx];
         const t3 = remaining[thirdIdx];
         
         const next = remaining.filter(t => t.id !== t1.id && t.id !== t2.id && t.id !== t3.id);
         if (canFormSets(next, setsNeeded - 1, hasPair)) return true;
       }
    }
  }

  return false;
}


// --- AI Decisions ---

export const getSimpleAIMove = (hand: Tile[]): Tile => {
  // 1. Discard isolated winds/dragons
  const isolatedHonor = hand.find(t => (t.suit === Suit.Wind || t.suit === Suit.Dragon) && 
    hand.filter(h => h.suit === t.suit && h.value === t.value).length === 1);
  
  if (isolatedHonor) return isolatedHonor;

  // 2. Discard terminals (1 or 9) if isolated
  const terminal = hand.find(t => (t.value === 1 || t.value === 9) && t.suit !== Suit.Wind && t.suit !== Suit.Dragon);
  if (terminal) return terminal;

  // 3. Random valid discard
  return hand[Math.floor(Math.random() * hand.length)];
};

export const getAIReaction = (hand: Tile[], discards: Tile[], activeTile: Tile, isLeftPlayer: boolean): ActionType | null => {
  // 1. Win?
  if (checkWin(hand, [], activeTile)) return ActionType.Hu;

  // 2. Pong? (Aggressive AI always Pongs honors or terminals)
  if (canPong(hand, activeTile)) {
    if (activeTile.suit === Suit.Dragon || activeTile.suit === Suit.Wind || activeTile.value === 1 || activeTile.value === 9) {
      return ActionType.Pong;
    }
    // 30% chance to pong simple tiles
    if (Math.random() > 0.7) return ActionType.Pong;
  }

  // 3. Chi? (Only from Left player)
  if (isLeftPlayer) {
    const options = canChi(hand, activeTile);
    if (options.length > 0 && Math.random() > 0.6) {
       return ActionType.Chi;
    }
  }

  return null;
};

export const formatHandForAI = (hand: Tile[]): string => {
  return sortHand(hand).map(t => t.name).join(', ');
};
