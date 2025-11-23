import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState, Player, GamePhase, ActionType, Tile } from '../shared/types';
import { 
  generateDeck, 
  sortHand, 
  checkWin, 
  canPong, 
  canChi, 
  canKong, 
  getPossibleAnKongs,
  getPossibleBuKongs 
} from '../shared/utils/mahjongLogic';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 允許任何來源連線 (開發用)
    methods: ["GET", "POST"]
  }
});

// --- Server State ---
interface Room {
  id: string;
  gameState: GameState | null;
  players: {
    socketId: string;
    name: string;
    seatIndex: number;
  }[];
  pendingClaimers: Player[]; // players who can respond to last discard
  lastDiscarder: Player | null;
}

const rooms: Record<string, Room> = {};

// Helper: Initial Game State (Same as your frontend initGame logic)
const createInitialGameState = (): GameState => {
  const deck = generateDeck();
  const players: GameState['players'] = {
    [Player.Bottom]: [],
    [Player.Right]: [],
    [Player.Top]: [],
    [Player.Left]: [],
  };
  const melds: GameState['melds'] = {
    [Player.Bottom]: [],
    [Player.Right]: [],
    [Player.Top]: [],
    [Player.Left]: [],
  };
  const discards: GameState['discards'] = {
    [Player.Bottom]: [],
    [Player.Right]: [],
    [Player.Top]: [],
    [Player.Left]: [],
  };
  const playerNames: GameState['playerNames'] = {
    [Player.Bottom]: '',
    [Player.Right]: '',
    [Player.Top]: '',
    [Player.Left]: '',
  };

  // Deal 16 tiles per player (Taiwan Mahjong hand size) then draw 1 for the starting player
  for (let i = 0; i < 16; i++) {
    Object.values(Player)
      .filter(p => typeof p === 'number')
      .forEach(p => {
        const tile = deck.pop();
        if (tile) players[p as Player].push(tile);
      });
  }

  // Sort initial hands for all players
  sortSeatHand(players, Player.Bottom);
  sortSeatHand(players, Player.Right);
  sortSeatHand(players, Player.Top);
  sortSeatHand(players, Player.Left);

  const startingPlayer = Player.Bottom;
  const drawnTile = deck.pop() ?? null;
  if (drawnTile) {
    players[startingPlayer].push(drawnTile);
  }

  return {
    deck,
    players,
    melds,
    discards,
    playerNames,
    currentPlayer: startingPlayer,
    phase: GamePhase.Discard,
    winner: null,
    lastDrawnTile: drawnTile,
    lastDiscardedTile: null,
    turnCount: 0,
    availableActions: [],
  };
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, gameState: null, players: [], pendingClaimers: [], lastDiscarder: null };
    }

    const room = rooms[roomId];
    
    // 檢查是否已經在房間
    const existingPlayer = room.players.find(p => p.socketId === socket.id);
    if (!existingPlayer) {
      if (room.players.length >= 4) {
        socket.emit('errorMsg', '房間已滿');
        return;
      }
      // 同房名稱不可重複
      const duplicateName = room.players.find(p => p.name === playerName);
      if (duplicateName) {
        socket.emit('errorMsg', '此名稱已被使用，請換一個暱稱');
        return;
      }
      const seatIndex = room.players.length;
      room.players.push({ socketId: socket.id, name: playerName, seatIndex });
      
      // 告訴客戶端 "你是幾號位"
      // 這裡我們暫時不發送完整狀態，直到遊戲開始
    }

    // 檢查是否滿 4 人，如果是，開始遊戲
    if (room.players.length === 4 && !room.gameState) {
      console.log(`Room ${roomId} starting game!`);
      room.gameState = createInitialGameState();
      broadcastState(roomId);
    } else if (room.gameState) {
      // 斷線重連或中途加入 (Spectator)
      broadcastState(roomId);
    }
  });

  socket.on('playerAction', ({ roomId, type, tileIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const gs = room.gameState;

    // 處理出牌
    if (type === 'Discard' && typeof tileIndex === 'number') {
      if (gs.currentPlayer !== player.seatIndex) return; // 不是你的回合
      
      const hand = gs.players[player.seatIndex];
      if (tileIndex < 0 || tileIndex >= hand.length) return;

      const [discarded] = hand.splice(tileIndex, 1);
      gs.discards[player.seatIndex].push(discarded);
      gs.lastDiscardedTile = { tile: discarded, fromPlayer: player.seatIndex };
      gs.lastDrawnTile = null;
      gs.phase = GamePhase.Action;
      gs.availableActions = [];
      room.lastDiscarder = player.seatIndex;
      sortSeatHand(gs.players, player.seatIndex);

      // 計算可以回應的玩家（除自己外），只保留真正有動作的人
      const claimers = [Player.Bottom, Player.Right, Player.Top, Player.Left]
        .filter(p => p !== player.seatIndex)
        // evaluate actions without requiring pendingClaimers set yet
        .filter(p => computeAvailableActions(gs, p, room, /*includePass*/ false, /*skipPendingCheck*/ true).length > 0);

      room.pendingClaimers = claimers;

      // 如果沒有人有動作，直接輪到下一位摸牌
      if (room.pendingClaimers.length === 0) {
        room.lastDiscarder = null;
        advanceTurnAfterPass(gs, player.seatIndex);
      }

      broadcastState(roomId);
      return;
    }

    // 處理暗槓（自己回合且有 4 張相同的牌）
    if (type === ActionType.AnKong && gs.currentPlayer === player.seatIndex && gs.phase === GamePhase.Discard) {
      const ankongs = getPossibleAnKongs(gs.players[player.seatIndex]);
      if (ankongs.length === 0) return;
      const target = ankongs[0]; // 簡化：若多組，取第一組

      // 找出四張同值同花的實際牌物件
      const tilesToRemove = gs.players[player.seatIndex]
        .filter(t => t.suit === target.suit && t.value === target.value)
        .slice(0, 4);
      if (tilesToRemove.length < 4) return;

      tilesToRemove.forEach(t => removeOneTile(gs.players[player.seatIndex], t));
      gs.melds[player.seatIndex].push({ type: ActionType.AnKong, tiles: tilesToRemove });
      gs.lastDiscardedTile = null;
      gs.lastDrawnTile = null;
      gs.availableActions = [];

      // 暗槓後補摸一張
      drawForPlayer(gs, player.seatIndex);
      broadcastState(roomId);
      return;
    }

    // 處理動作 (吃/碰/槓/胡/Pass)
    if (gs.phase !== GamePhase.Action || !gs.lastDiscardedTile) return;
    if (!room.pendingClaimers.includes(player.seatIndex)) return;

    const discardTile = gs.lastDiscardedTile.tile;
    const hand = gs.players[player.seatIndex];

    if (type === ActionType.Pass) {
      room.pendingClaimers = room.pendingClaimers.filter(p => p !== player.seatIndex);
      if (room.pendingClaimers.length === 0) {
        const from = gs.lastDiscardedTile.fromPlayer;
        room.lastDiscarder = null;
        gs.lastDiscardedTile = null;
        advanceTurnAfterPass(gs, from);
      }
      broadcastState(roomId);
      return;
    }

    if (type === ActionType.Hu) {
      const canHu = checkWin(hand, gs.melds[player.seatIndex], discardTile);
      if (canHu) {
        gs.winner = player.seatIndex;
        gs.phase = GamePhase.GameOver;
        room.pendingClaimers = [];
        room.lastDiscarder = null;
      }
      broadcastState(roomId);
      return;
    }

    if (type === ActionType.Pong && canPong(hand, discardTile)) {
      meldFromDiscard(gs, player.seatIndex, discardTile, 2, ActionType.Pong);
      finalizeClaimTurn(gs, room, player.seatIndex);
      broadcastState(roomId);
      return;
    }

    if (type === ActionType.Kong && canKong(hand, discardTile)) {
      meldFromDiscard(gs, player.seatIndex, discardTile, 3, ActionType.Kong);
      drawForPlayer(gs, player.seatIndex);
      finalizeClaimTurn(gs, room, player.seatIndex);
      broadcastState(roomId);
      return;
    }

    if (type === ActionType.Chi && room.lastDiscarder !== null) {
      const isNext = ((room.lastDiscarder + 1) % 4) === player.seatIndex;
      const chiOptions = canChi(hand, discardTile);
      if (isNext && chiOptions.length > 0) {
        const useTiles = chiOptions[0]; // 簡化：自動使用第一組
        useTiles.forEach(t => removeOneTile(gs.players[player.seatIndex], t));
        gs.melds[player.seatIndex].push({ type: ActionType.Chi, tiles: [discardTile, ...useTiles] });
        finalizeClaimTurn(gs, room, player.seatIndex);
        broadcastState(roomId);
        return;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    Object.values(rooms).forEach(room => {
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        // Any player leaves: disconnect everyone else and remove the room
        room.players.splice(idx, 1);
        room.players.forEach(p => {
          io.to(p.socketId).disconnectSockets(true);
        });
        delete rooms[room.id];
      }
    });
  });

  socket.on('resetGame', (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.players.length < 4) {
      io.to(socket.id).emit('errorMsg', '需要 4 位玩家才能開始遊戲');
      return;
    }
    room.gameState = createInitialGameState();
    broadcastState(roomId);
  });
});

// 廣播狀態給房間內所有人
function broadcastState(roomId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState) return;

  room.players.forEach(p => {
    // 為每個玩家計算他可用的動作
    const availableActions = room.gameState!.phase === GamePhase.Action
      ? computeAvailableActions(room.gameState!, p.seatIndex, room)
      : (p.seatIndex === room.gameState!.currentPlayer ? room.gameState!.availableActions : []);
    const stateForPlayer: GameState = { 
      ...room.gameState!, 
      availableActions,
      playerNames: buildPlayerNames(room),
    };
    io.to(p.socketId).emit('updateState', stateForPlayer, p.seatIndex);
  });
}

const PORT = 3001;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`SERVER RUNNING ON http://${HOST}:${PORT}`);
});

// --- helpers ---

function computeAvailableActions(gs: GameState, seat: Player, room: Room, includePass = true, skipPendingCheck = false): ActionType[] {
  if (gs.phase !== GamePhase.Action || !gs.lastDiscardedTile) return [];
  if (!skipPendingCheck && !room.pendingClaimers.includes(seat)) return [];

  const tile = gs.lastDiscardedTile.tile;
  const hand = gs.players[seat];
  const actions: ActionType[] = [];

  if (checkWin(hand, gs.melds[seat], tile)) actions.push(ActionType.Hu);
  if (canKong(hand, tile)) actions.push(ActionType.Kong);
  if (canPong(hand, tile)) actions.push(ActionType.Pong);

  const isNext = room.lastDiscarder !== null && ((room.lastDiscarder + 1) % 4) === seat;
  if (isNext && canChi(hand, tile).length > 0) {
    actions.push(ActionType.Chi);
  }

  if (includePass && actions.length > 0) {
    actions.push(ActionType.Pass);
  }
  return actions;
}

function advanceTurnAfterPass(gs: GameState, fromPlayer: Player) {
  const nextPlayer = ((fromPlayer + 1) % 4) as Player;
  gs.currentPlayer = nextPlayer;
  gs.phase = GamePhase.Draw;
  gs.lastDiscardedTile = null;

  drawForPlayer(gs, nextPlayer);
}

function drawForPlayer(gs: GameState, seat: Player) {
  const draw = gs.deck.pop() ?? null;
  if (draw) {
    gs.players[seat].push(draw);
    sortSeatHand(gs.players, seat);
    gs.lastDrawnTile = draw;
    // 自摸檢查
    const win = checkWin(gs.players[seat], gs.melds[seat], draw);
    if (win) {
      gs.winner = seat;
      gs.phase = GamePhase.GameOver;
      return;
    }
  }

  if (gs.deck.length === 0) {
    gs.phase = GamePhase.GameOver;
    return;
  }

  gs.phase = GamePhase.Discard;
  gs.turnCount += 1;
  // 自己回合檢查暗槓
  const ankongOptions = getPossibleAnKongs(gs.players[seat]);
  gs.availableActions = ankongOptions.length > 0 ? [ActionType.AnKong] : [];
}

function meldFromDiscard(gs: GameState, seat: Player, tile: Tile, needMatches: number, type: ActionType) {
  const hand = gs.players[seat];
  const matches = hand.filter(t => t.suit === tile.suit && t.value === tile.value).slice(0, needMatches);
  matches.forEach(t => removeOneTile(hand, t));
  sortSeatHand(gs.players, seat);
  gs.melds[seat].push({ type, tiles: [tile, ...matches] });
  gs.lastDiscardedTile = null;
  gs.lastDrawnTile = null;
  gs.currentPlayer = seat;
  gs.phase = GamePhase.Discard;
  gs.availableActions = [];
}

function removeOneTile(hand: Tile[], target: Tile) {
  const idx = hand.findIndex(t => t.id === target.id);
  if (idx >= 0) hand.splice(idx, 1);
}

function finalizeClaimTurn(gs: GameState, room: Room, seat: Player) {
  room.pendingClaimers = [];
  room.lastDiscarder = null;
  // 若槓後已胡或牌山空，直接返回
  if (gs.phase === GamePhase.GameOver) return;
  gs.currentPlayer = seat;
  gs.phase = GamePhase.Discard;
  gs.availableActions = [];
}

function sortSeatHand(players: GameState['players'], seat: Player) {
  players[seat] = sortHand(players[seat]);
}

function buildPlayerNames(room: Room): GameState['playerNames'] {
  const names: GameState['playerNames'] = {
    [Player.Bottom]: '',
    [Player.Right]: '',
    [Player.Top]: '',
    [Player.Left]: '',
  };
  room.players.forEach(p => {
    names[p.seatIndex] = p.name || '';
  });
  return names;
}
