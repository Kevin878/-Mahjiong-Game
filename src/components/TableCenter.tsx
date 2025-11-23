import React from 'react';
import { Tile, Player } from '../../shared/types';
import TileComponent from './TileComponent';

interface TableCenterProps {
  discards: { [key in Player]: Tile[] };
  currentPlayer: Player;
  turnCount: number;
  activeDiscard: { tile: Tile; fromPlayer: Player } | null;
}

const TableCenter: React.FC<TableCenterProps> = ({ discards, currentPlayer, turnCount, activeDiscard }) => {
  
  const renderDiscards = (player: Player, className: string) => {
    const tiles = discards[player].slice(-16);
    
    return (
      // Increased width to w-56 to fit larger md tiles in a grid
      <div className={`absolute flex flex-wrap gap-1 w-56 content-start justify-center ${className}`}>
        {tiles.map((tile, idx) => {
           // Highlight the very last discard on the table
           const isLast = activeDiscard && activeDiscard.tile.id === tile.id;
           return (
             <div key={`${tile.id}-${idx}`} className={isLast ? "ring-4 ring-yellow-400 rounded shadow-xl z-10 scale-110 transition-all" : ""}>
               <TileComponent tile={tile} size="md" />
             </div>
           )
        })}
      </div>
    );
  };

  const renderPlayerInfo = (player: Player, className: string, label: string) => (
    <div className={`absolute ${className} bg-black/40 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 backdrop-blur-sm border border-white/10 z-20`}>
      <span className="font-bold text-white/90">{label}</span>
      {currentPlayer === player && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />}
    </div>
  );

  return (
    <div className="relative w-full h-full bg-[#153d22] rounded-xl border-8 border-[#2a1810] shadow-2xl flex items-center justify-center overflow-hidden">
      
      {/* Center Status */}
      <div className="absolute z-0 opacity-20 pointer-events-none">
         <div className="w-32 h-32 rounded-full border-4 border-white/30 flex items-center justify-center">
            <div className="text-5xl font-serif text-white">Zen</div>
         </div>
      </div>

      {/* Discard Areas - All upright (facing player) */}
      {/* Top: Standard grid */}
      {renderDiscards(Player.Top, "top-10 left-1/2 -translate-x-1/2")}
      
      {/* Bottom: Standard grid - Moved up to avoid hand overlap */}
      {renderDiscards(Player.Bottom, "bottom-24 md:bottom-36 left-1/2 -translate-x-1/2")}
      
      {/* Left: Positioned left, but no rotation on container so tiles are upright */}
      {renderDiscards(Player.Left, "left-2 top-1/2 -translate-y-1/2")}
      
      {/* Right: Positioned right, no rotation */}
      {renderDiscards(Player.Right, "right-2 top-1/2 -translate-y-1/2")}
    </div>
  );
};

export default TableCenter;