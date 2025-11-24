import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Player, Tile, GameState, GamePhase, ActionType, Meld } from '../shared/types';
import { HUMAN_PLAYER } from '../shared/constants';
import TileComponent from './components/TileComponent';
import TableCenter from './components/TableCenter';
import ActionPanel from './components/ActionPanel';
import bgMusic from './music/never-gonna-give-you-up-official-video-4k-remaster.mp3';
import defaultAvatar from './assets/default-avatar.svg';

const ACTION_TIMEOUT_MS = 3000;

// --- Types for Multiplayer ---
interface ClientState extends GameState {
  myPlayerId: Player | null; // The server tells us which seat we are in (0-3)
}

// Initialize Socket (Assuming server runs on localhost:3001)
// In production, change this URL to your server IP
const URL = `http://${window.location.hostname}:3001`;
const socket: Socket = io(URL, { autoConnect: false });

const App: React.FC = () => {
  // --- State ---
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [inRoom, setInRoom] = useState(false);
  const [gameState, setGameState] = useState<ClientState | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Lobby State
  const [roomId, setRoomId] = useState("room1");
  const [playerName, setPlayerName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [musicError, setMusicError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldPlayMusic = inRoom && !!gameState;
  const [customMusicUrl, setCustomMusicUrl] = useState<string | null>(null);
  const [customMusicName, setCustomMusicName] = useState<string>("");
  const currentAudioSrcRef = useRef<string | null>(null);
  const lobbyFileInputRef = useRef<HTMLInputElement | null>(null);
  const inGameFileInputRef = useRef<HTMLInputElement | null>(null);
  const lobbyAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const inGameAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [actionCountdown, setActionCountdown] = useState<number | null>(null);
  const actionDeadlineRef = useRef<number | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>("");

  // --- Socket Event Listeners ---
  useEffect(() => {
    // 防止 HMR 或頁面重載後仍保留舊連線
    if (socket.connected) {
      socket.disconnect();
    }

    function onConnect() {
      setIsConnected(true);
      setErrorMsg("");
      setIsConnecting(false);
    }

    function onDisconnect() {
      setIsConnected(false);
      setInRoom(false);
      setGameState(null);
      setIsConnecting(false);
    }

    function onGameStateUpdate(newState: GameState, myPid: Player) {
      console.log("Received State Update:", newState);
      setGameState({ ...newState, myPlayerId: myPid });
      setInRoom(true);
      setIsConnecting(false);
    }

    function onError(msg: string) {
      setErrorMsg(msg);
      setIsConnecting(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('updateState', onGameStateUpdate);
    socket.on('errorMsg', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('updateState', onGameStateUpdate);
      socket.off('errorMsg', onError);
      socket.disconnect();
    };
  }, []);

  // --- Background Music ---
  useEffect(() => {
    // Create the audio element once
    if (!audioRef.current) {
      audioRef.current = new Audio(bgMusic);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
    }
    const audio = audioRef.current;
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  // Revoke object URLs when switching or unmounting
  useEffect(() => {
    return () => {
      const urlCreator = window.URL || window.webkitURL;
      if (customMusicUrl && urlCreator?.revokeObjectURL) urlCreator.revokeObjectURL(customMusicUrl);
    };
  }, [customMusicUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const newSrc = customMusicUrl || bgMusic;
    if (currentAudioSrcRef.current !== newSrc) {
      currentAudioSrcRef.current = newSrc;
      audio.src = newSrc;
      audio.load();
    }

    if (shouldPlayMusic) {
      audio.play().catch(err => {
        console.warn('Unable to start background music:', err);
        setMusicError("瀏覽器封鎖了自動播放，請點擊螢幕後再試");
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [customMusicUrl, shouldPlayMusic]);

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('audio')) {
      setMusicError("請選擇音訊檔（建議 MP3）");
      return;
    }
    const urlCreator = window.URL || window.webkitURL;
    if (!urlCreator?.createObjectURL) {
      setMusicError("瀏覽器不支援檔案預覽，請改用支援 createObjectURL 的環境");
      return;
    }
    const url = urlCreator.createObjectURL(file);
    setCustomMusicUrl(url);
    setCustomMusicName(file.name);
    setMusicError("");
  };

  const resetMusic = () => {
    setCustomMusicUrl(null);
    setCustomMusicName("");
    setMusicError("");
    if (lobbyFileInputRef.current) lobbyFileInputRef.current.value = "";
    if (inGameFileInputRef.current) inGameFileInputRef.current.value = "";
  };

  const currentMusicLabel = customMusicName || "Never Gonna Give You Up（預設）";

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError("請選擇圖片檔作為大頭貼");
      return;
    }
    setAvatarError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetAvatar = () => {
    setAvatarDataUrl("");
    setAvatarError("");
    if (lobbyAvatarInputRef.current) lobbyAvatarInputRef.current.value = "";
    if (inGameAvatarInputRef.current) inGameAvatarInputRef.current.value = "";
  };

  useEffect(() => {
    if (!inRoom || !socket.connected) return;
    socket.emit('setAvatar', { roomId, dataUrl: avatarDataUrl || '' });
  }, [avatarDataUrl, inRoom, roomId]);

  const getPlayerAvatar = (relativePos: Player): string => {
    const abs = getAbsolutePlayerFromRelative(relativePos);
    if (abs === null) return defaultAvatar;
    const fromState = gameState?.playerAvatars?.[abs];
    return fromState && fromState.length > 0 ? fromState : defaultAvatar;
  };

  // --- Action countdown timer (client-side indicator) ---
  useEffect(() => {
    if (gameState?.phase === GamePhase.Action && gameState.lastDiscardedTile) {
      actionDeadlineRef.current = Date.now() + ACTION_TIMEOUT_MS;
    } else {
      actionDeadlineRef.current = null;
      setActionCountdown(null);
      return;
    }

    const tick = () => {
      if (!actionDeadlineRef.current) return;
      const remainingMs = actionDeadlineRef.current - Date.now();
      if (remainingMs <= 0) {
        setActionCountdown(0);
        actionDeadlineRef.current = null;
        return;
      }
      setActionCountdown(Math.ceil(remainingMs / 1000));
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [gameState?.phase, gameState?.lastDiscardedTile?.tile.id, gameState?.turnCount]);

  // --- Actions ---

  const joinRoom = () => {
    if (!playerName) {
      setErrorMsg("請輸入名字");
      return;
    }
    setErrorMsg("");
    setIsConnecting(true);
    socket.connect();
    socket.emit('joinRoom', { roomId, playerName });
  };

  const handleHumanDiscard = (tileId: string) => {
    if (!gameState || gameState.myPlayerId === null) return;
    const hand = gameState.players[gameState.myPlayerId];
    const tileIndex = hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) return;
    
    // Validation: Is it my turn?
    if (gameState.currentPlayer !== gameState.myPlayerId) return;
    if (gameState.phase !== GamePhase.Discard) return;

    // Double click logic
    if (selectedTileId !== tileId) {
        setSelectedTileId(tileId);
        return;
    }

    // Emit Action to Server
    socket.emit('playerAction', { 
      roomId, 
      type: 'Discard', 
      tileIndex 
    });
    setSelectedTileId(null);
  };

  const handleHumanAction = (action: ActionType) => {
    if (!gameState) return;
    socket.emit('playerAction', { 
      roomId, 
      type: action 
    });
  };

  const resetGame = () => {
    if(gameState) socket.emit('resetGame', roomId);
  };

  // --- View Logic: Relative Positioning ---
  
  // This is crucial for multiplayer.
  // Server knows players as 0, 1, 2, 3 (Absolute).
  // Client needs to see "Me" at Bottom, "Next" at Right, etc.
  const getRelativePlayer = (targetPlayer: Player): Player => {
    if (!gameState || gameState.myPlayerId === null) return targetPlayer;
    
    // Formula: (Target - Me + 4) % 4
    // If I am 2 (Top), and I want to render 2. (2-2+4)%4 = 0 (Bottom) -> Correct, I see myself at bottom.
    // If I am 2, render 3 (Left). (3-2+4)%4 = 1 (Right) -> Correct, Left is to my Right.
    const relativeIndex = (targetPlayer - gameState.myPlayerId + 4) % 4;
    return relativeIndex as Player;
  };

  // Helper to get the Absolute Player ID from a Relative Position
  // Used because renderHand asks for "Who sits at Bottom (relative)?" 
  // and we need to find which Absolute ID corresponds to that.
  const getAbsolutePlayerFromRelative = (relativePos: Player): Player | null => {
    if (!gameState || gameState.myPlayerId === null) return null;
    
    // If Me=2, Relative=0(Bottom). We want 2. formula: (Relative + Me) % 4
    // (0 + 2) % 4 = 2.
    return (relativePos + gameState.myPlayerId) % 4 as Player;
  };
  
  const getPlayerLabel = (relativePos: Player): string | null => {
    const abs = getAbsolutePlayerFromRelative(relativePos);
    if (abs === null) return null;
    const name = gameState?.playerNames?.[abs];
    const fallback = abs === gameState?.myPlayerId ? "你" : `玩家${abs}`;
    return name || fallback;
  };

  // --- Rendering ---

  const renderMelds = (melds: Meld[], orientation: 'horizontal' | 'vertical') => {
     return (
        <div className={`flex ${orientation === 'vertical' ? 'flex-col gap-3' : 'gap-3'} p-1 rounded-lg pointer-events-none`}>
            {melds.map((meld, idx) => (
                <div key={`meld-${idx}`} className="flex gap-0 shadow-lg bg-black/10 rounded p-0.5 border border-white/10">
                   {meld.tiles.map((t, tIdx) => (
                       <TileComponent 
                         key={`${t.id}-${tIdx}`} 
                         tile={t} 
                         size="md" 
                         isSideways={false}
                         isHidden={meld.type === ActionType.AnKong && tIdx > 0 && tIdx < 3 && orientation === 'horizontal'} 
                       />
                   ))}
                </div>
            ))}
        </div>
     );
  }

  const renderHand = (relativePosition: Player) => {
    if (!gameState || gameState.myPlayerId === null) return null;

    // Convert the requested RELATIVE position (e.g. Bottom) to the ABSOLUTE player ID (e.g. Player 2)
    const targetAbsPlayer = getAbsolutePlayerFromRelative(relativePosition);
    if (targetAbsPlayer === null) return null;

    const isMe = targetAbsPlayer === gameState.myPlayerId;
    const hand = gameState.players[targetAbsPlayer];
    const melds = gameState.melds[targetAbsPlayer] || [];

    // 1. Bottom (Me)
    if (relativePosition === Player.Bottom) {
      // Put freshly drawn tile to the far right with a gap
      const isMyTurn = isMe && gameState.currentPlayer === gameState.myPlayerId && gameState.phase === GamePhase.Discard;
      const lastDrawnId = isMyTurn ? gameState.lastDrawnTile?.id : undefined;
      const displayHand = isMyTurn && lastDrawnId
        ? [
            ...hand.filter(t => t.id !== lastDrawnId),
            hand.find(t => t.id === lastDrawnId) as Tile
          ].filter(Boolean)
        : hand;

      return (
         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6 items-end z-30">
            <div className="flex items-end">
               {displayHand.map((tile, index) => {
                  const isLastDrawn = isMyTurn && gameState.lastDrawnTile?.id === tile.id;
                  // Separate freshly drawn tile from the rest
                  const gapClass = isLastDrawn ? 'ml-4 md:ml-6' : '';
                  return (
                     <div key={tile.id} className={`transition-all ${gapClass}`}>
                       <TileComponent 
                         tile={tile} 
                         isSelected={selectedTileId === tile.id}
                         onClick={() => isMe ? handleHumanDiscard(tile.id) : undefined}
                         size="xl"
                       />
                     </div>
                  )
               })}
            </div>
            {melds.length > 0 && renderMelds(melds, 'horizontal')}
         </div>
      );
    }

    // 2. Top (Across)
    if (relativePosition === Player.Top) {
       return (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-row-reverse gap-6 items-start z-10">
             <div className="flex gap-1">
                {hand.map((tile, i) => (
                   <TileComponent key={i} tile={tile} isHidden={true} size="sm" />
                ))}
             </div>
             {melds.length > 0 && renderMelds(melds, 'horizontal')}
          </div>
       );
    }

    // 3. Left
    if (relativePosition === Player.Left) {
       return (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col -space-y-2 md:-space-y-4 z-20">
                {hand.map((tile, i) => (
                   <TileComponent key={i} tile={tile} isHidden={true} isSideways={true} size="sm" />
                ))}
            </div>
            {melds.length > 0 && (
                <div className="absolute left-16 md:left-24 top-[20%] flex flex-col gap-3 z-20">
                   {renderMelds(melds, 'vertical')}
                </div>
            )}
          </>
       );
    }

    // 4. Right
    if (relativePosition === Player.Right) {
       return (
          <>
             <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col -space-y-2 md:-space-y-4 z-20">
                {hand.map((tile, i) => (
                   <TileComponent key={i} tile={tile} isHidden={true} isSideways={true} size="sm" />
                ))}
             </div>
             {melds.length > 0 && (
                 <div className="absolute right-16 md:right-24 top-[20%] flex flex-col gap-3 items-end z-20">
                    {renderMelds(melds, 'vertical')}
                 </div>
             )}
          </>
       );
    }

    return null;
  };

  // --- LOBBY UI ---
  if (!inRoom || !gameState) {
    return (
      <div className="w-full h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
         <h1 className="text-6xl mb-8 text-yellow-400" style={{ fontFamily: 'var(--heading-font)' }}>麻John大亂鬥</h1>
         
         <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-96 flex flex-col gap-4 border border-slate-700">
            <div>
              <label className="block text-sm text-gray-400 mb-1">玩家名稱</label>
              <input 
                type="text" 
                value={playerName}
                onChange={e => {
                  setPlayerName(e.target.value);
                  setErrorMsg("");
                }}
                className="w-full p-3 bg-slate-900 rounded border border-slate-600 text-white focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="輸入您的暱稱"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">房間號碼</label>
              <input 
                type="text" 
                value={roomId}
                onChange={e => {
                  setRoomId(e.target.value);
                  setErrorMsg("");
                }}
                className="w-full p-3 bg-slate-900 rounded border border-slate-600 text-white focus:ring-2 focus:ring-green-500 outline-none"
                placeholder="Room ID"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-400">大頭貼</label>
                <button 
                  onClick={resetAvatar}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600"
                >
                  使用預設大頭貼
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-600 bg-slate-700 shrink-0">
                  <img src={avatarDataUrl || defaultAvatar} alt="avatar preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarUpload}
                    ref={lobbyAvatarInputRef}
                    className="w-full text-sm text-gray-300 file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-indigo-700 file:text-white hover:file:bg-indigo-600"
                  />
                  {avatarError && <div className="text-red-400 text-xs">{avatarError}</div>}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-400">背景音樂</label>
                <button 
                  onClick={resetMusic}
                  disabled={!customMusicUrl}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  使用預設音樂
                </button>
              </div>
              <input 
                type="file" 
                accept="audio/mpeg,audio/mp3,audio/*" 
                onChange={handleMusicUpload}
                ref={lobbyFileInputRef}
                className="w-full text-sm text-gray-300 file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-green-700 file:text-white hover:file:bg-green-600"
              />
              {musicError && <div className="text-red-400 text-xs">{musicError}</div>}
              <div className="text-xs text-gray-400 line-clamp-1">目前：{currentMusicLabel}</div>
            </div>
            
            {errorMsg && <div className="text-red-400 text-sm">{errorMsg}</div>}

            <button 
              onClick={joinRoom}
              disabled={!playerName || isConnecting}
              className="mt-4 w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? "連線中..." : "加入房間"}
            </button>
         </div>
      </div>
    );
  }

  // --- GAME UI ---
  
  // We need to pass rotated views to TableCenter
  // TableCenter expects `discards` keyed by ABSOLUTE player ID, 
  // BUT the View Rotation is visual. 
  // Actually, TableCenter logic uses `renderDiscards(Player.Top)` etc.
  // We should probably wrap TableCenter or modify it to render based on Relative Position?
  // Or better, we just let TableCenter use Absolute IDs, but we CSS position them differently?
  // For simplicity, let's keep TableCenter as is (Absolute), but we need to ensure the CSS classes match the visual rotation.
  // WAIT: TableCenter hardcodes `renderDiscards(Player.Top, "top-10...")`.
  // If I am Player 1 (Right), then Player.Top (2) is visually to my Left.
  // TableCenter needs to know "Which Absolute Player is at Visual Top?".
  // Let's modify how we pass props or how TableCenter renders.
  
  // Easier fix: Pass a "rotatedDiscards" map to TableCenter where:
  // Key 0 (Visual Bottom) -> Discards of GetAbs(Bottom)
  // Key 1 (Visual Right) -> Discards of GetAbs(Right)
  // ...
  
  const rotatedDiscards = {
    [Player.Bottom]: gameState.discards[getAbsolutePlayerFromRelative(Player.Bottom)!],
    [Player.Right]: gameState.discards[getAbsolutePlayerFromRelative(Player.Right)!],
    [Player.Top]: gameState.discards[getAbsolutePlayerFromRelative(Player.Top)!],
    [Player.Left]: gameState.discards[getAbsolutePlayerFromRelative(Player.Left)!],
  };

  // Also need to rotate the `currentPlayer` prop so the highlight shows on the correct visual seat
  const relativeCurrentPlayer = getRelativePlayer(gameState.currentPlayer);
  const currentPlayerAbs = getAbsolutePlayerFromRelative(relativeCurrentPlayer);
  const currentPlayerName = currentPlayerAbs !== null
    ? (gameState.playerNames?.[currentPlayerAbs] || `玩家${currentPlayerAbs}`)
    : null;
  
  // Also rotate `lastDiscardedTile.fromPlayer`
  const rotatedLastDiscard = gameState.lastDiscardedTile ? {
    tile: gameState.lastDiscardedTile.tile,
    fromPlayer: getRelativePlayer(gameState.lastDiscardedTile.fromPlayer)
  } : null;

  return (
    <div className="w-full h-screen bg-slate-800 overflow-hidden relative select-none">
       
       {/* Room Info */}
       <div className="absolute top-4 left-4 text-white/50 z-50 text-xs">
          Room: {roomId} | You: {playerName}
       </div>
       <div className="absolute top-4 right-4 z-50 text-xs text-white">
          <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 flex flex-col gap-2 shadow min-w-[220px]">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-slate-700 shrink-0">
                <img src={avatarDataUrl || defaultAvatar} alt="avatar preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="text-white/70">我的大頭貼</div>
                <div className="flex items-center gap-2 mt-1">
                  <label className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 cursor-pointer text-[11px]">
                    重新選擇
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                      ref={inGameAvatarInputRef}
                      className="hidden" 
                    />
                  </label>
                  <button 
                    onClick={resetAvatar} 
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px]"
                  >
                    預設
                  </button>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-2 space-y-1">
              <div className="text-white/70">背景音樂</div>
              <div className="text-white line-clamp-1 max-w-[180px]" title={currentMusicLabel}>{currentMusicLabel}</div>
              <div className="flex items-center gap-2">
                <label className="px-2 py-1 rounded bg-green-700 hover:bg-green-600 cursor-pointer text-[11px]">
                  重新選擇
                  <input 
                    type="file" 
                    accept="audio/mpeg,audio/mp3,audio/*" 
                    onChange={handleMusicUpload} 
                    ref={inGameFileInputRef}
                    className="hidden" 
                  />
                </label>
                <button 
                  onClick={resetMusic} 
                  disabled={!customMusicUrl}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  預設
                </button>
              </div>
            </div>
          </div>
       </div>
       
       {/* Player name overlays (rotated to your perspective) */}
       <div className="absolute inset-0 pointer-events-none z-40 text-white">
         <div className="absolute left-1/2 top-[62%] -translate-x-1/2 flex flex-col items-center gap-1">
           <img src={getPlayerAvatar(Player.Bottom)} alt="avatar bottom" className="w-12 h-12 rounded-full border border-white/20 bg-slate-800 object-cover" />
           <div className="px-3 py-1 rounded-lg bg-black/50 border border-white/10">
             {getPlayerLabel(Player.Bottom)}
           </div>
         </div>
         <div className="absolute left-1/2 top-[32%] -translate-x-1/2 flex flex-col items-center gap-1">
           <img src={getPlayerAvatar(Player.Top)} alt="avatar top" className="w-12 h-12 rounded-full border border-white/20 bg-slate-800 object-cover" />
           <div className="px-3 py-1 rounded-lg bg-black/50 border border-white/10">
             {getPlayerLabel(Player.Top)}
           </div>
         </div>
         <div className="absolute left-[30%] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
           <img src={getPlayerAvatar(Player.Left)} alt="avatar left" className="w-12 h-12 rounded-full border border-white/20 bg-slate-800 object-cover" />
           <div className="px-3 py-1 rounded-lg bg-black/50 border border-white/10">
             {getPlayerLabel(Player.Left)}
           </div>
         </div>
         <div className="absolute right-[30%] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
           <img src={getPlayerAvatar(Player.Right)} alt="avatar right" className="w-12 h-12 rounded-full border border-white/20 bg-slate-800 object-cover" />
           <div className="px-3 py-1 rounded-lg bg-black/50 border border-white/10">
             {getPlayerLabel(Player.Right)}
           </div>
         </div>
       </div>

      <div className="absolute inset-4 md:inset-12">
         {/* Turn indicator */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
           <div className="px-4 py-3 bg-black/70 text-white rounded-2xl text-base md:text-lg shadow-lg border border-white/10 backdrop-blur-sm">
             {gameState.phase === GamePhase.Action && gameState.lastDiscardedTile
               ? `請等待玩家進行吃、碰、槓操作，倒數 ${actionCountdown ?? Math.ceil(ACTION_TIMEOUT_MS / 1000)} 秒`
               : currentPlayerAbs !== null
                 ? (currentPlayerAbs === gameState.myPlayerId
                      ? '現在輪到你出牌'
                      : `等待由 ${currentPlayerName} 出牌`)
                 : '等待中…'}
           </div>
         </div>

          <TableCenter 
            discards={rotatedDiscards} 
            currentPlayer={relativeCurrentPlayer} // Pass visual current player
            turnCount={gameState.turnCount}
            activeDiscard={rotatedLastDiscard} // Pass visual discard source
          />
       </div>

       {/* Render Hands by Relative Position */}
       {renderHand(Player.Top)}
       {renderHand(Player.Left)}
       {renderHand(Player.Right)}
       {renderHand(Player.Bottom)}

       <ActionPanel 
         availableActions={gameState.availableActions} 
         onAction={handleHumanAction} 
       />

       {gameState.phase === GamePhase.GameOver && (
         <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white">
            <h1 className="text-6xl font-serif mb-8 text-yellow-400">
              {gameState.winner === gameState.myPlayerId 
                ? "胡牌! You Win!" 
                : gameState.winner !== null 
                  ? `${gameState.playerNames?.[gameState.winner] || `玩家${gameState.winner}`} 獲勝`
                  : "Draw!"}
            </h1>
            <button onClick={resetGame} className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full text-xl font-bold shadow-lg transition-all">
              Play Again
            </button>
         </div>
       )}
    </div>
  );
};

export default App;
