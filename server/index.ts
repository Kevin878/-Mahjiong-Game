import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
// 假設您將邏輯檔案放到了 server/shared 資料夾
import { GameState, Player, GamePhase, ActionType, Tile } from './shared/types';
import { 
  generateDeck, 
  sortHand, 
  checkWin, 
  canPong, 
  canChi, 
  canKong, 
  getPossibleAnKongs,
  getPossibleBuKongs 
} from './shared/utils/mahjongLogic';

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
  // ... (使用您的 initGame 邏輯，產生洗好的牌局) ...
  // 回傳完整的 GameState 物件
  // 記得這裡沒有 "human player" 的概念，所有玩家都是平等的
  return {} as GameState; // 佔位符
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
      
      // 執行出牌邏輯 (processDiscard)
      // 更新 gs.players, gs.discards, gs.phase...
      // ... 這裡需要將您 App.tsx 的 handleHumanDiscard 邏輯搬過來 ...

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
    // 處理玩家離線邏輯 (暫停遊戲或踢出)
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

server.listen(3001, () => {
  console.log('SERVER RUNNING ON PORT 3001');
});