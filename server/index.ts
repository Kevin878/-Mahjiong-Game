import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
// 假設您將邏輯檔案放到了 server/shared 資料夾
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

  // Deal 16 tiles per player (Taiwan Mahjong hand size) then draw 1 for the starting player
  for (let i = 0; i < 16; i++) {
    Object.values(Player)
      .filter(p => typeof p === 'number')
      .forEach(p => {
        const tile = deck.pop();
        if (tile) players[p as Player].push(tile);
      });
  }

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
      rooms[roomId] = { id: roomId, gameState: null, players: [] };
    }

    const room = rooms[roomId];
    
    // 檢查是否已經在房間
    const existingPlayer = room.players.find(p => p.socketId === socket.id);
    if (!existingPlayer) {
      if (room.players.length >= 4) {
        socket.emit('errorMsg', '房間已滿');
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
      room.gameState = createInitialGameState(); // 您需要實作這個
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

      // Rotate to next player and draw a tile
      const nextPlayer = ((player.seatIndex + 1) % 4) as Player;
      gs.currentPlayer = nextPlayer;
      const nextDraw = gs.deck.pop() ?? null;
      if (nextDraw) {
        gs.players[nextPlayer].push(nextDraw);
        gs.lastDrawnTile = nextDraw;
      }

      // Check win after draw
      const hasWin = nextDraw
        ? checkWin(gs.players[nextPlayer], gs.melds[nextPlayer], nextDraw)
        : false;
      if (hasWin) {
        gs.winner = nextPlayer;
        gs.phase = GamePhase.GameOver;
      } else if (gs.deck.length === 0) {
        gs.phase = GamePhase.GameOver;
      } else {
        gs.phase = GamePhase.Discard;
      }

      gs.turnCount += 1;
      gs.availableActions = [];

      broadcastState(roomId);
    }

    // 處理動作 (吃/碰/槓/胡)
    else {
      // ... 這裡需要將您 App.tsx 的 executeActionState 邏輯搬過來 ...
      broadcastState(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    Object.values(rooms).forEach(room => {
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[room.id];
        } else {
          room.gameState = null; // clear state so a fresh game can start when room refills
          broadcastState(room.id);
        }
      }
    });
  });

  socket.on('resetGame', (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    room.gameState = createInitialGameState();
    broadcastState(roomId);
  });
});

// 廣播狀態給房間內所有人
function broadcastState(roomId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState) return;

  room.players.forEach(p => {
    // 傳送給每個人時，告訴他們 "myPlayerId" 是多少，讓前端能計算相對視角
    io.to(p.socketId).emit('updateState', room.gameState, p.seatIndex);
  });
}

const PORT = 3001;
const HOST = '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`SERVER RUNNING ON http://${HOST}:${PORT}`);
});
