import React from 'react';
import { Tile, Suit } from '../../shared/types';

interface TileProps {
  tile: Tile;
  isHidden?: boolean;
  isSideways?: boolean; // For discards or pong
  onClick?: () => void;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const TileComponent: React.FC<TileProps> = ({ 
  tile, 
  isHidden = false, 
  isSideways = false, 
  onClick, 
  isSelected = false,
  size = 'md',
  className = ''
}) => {
  
  // Size mappings (Updated for larger visuals)
  // xl: Player hand - increased height and desktop width
  // md: Table discards - increased for visibility
  const sizeClasses = {
    sm: "w-4 h-6 md:w-6 md:h-8 text-xs md:text-lg", 
    md: "w-7 h-10 md:w-9 md:h-12 text-lg md:text-2xl", // Larger discards
    lg: "w-9 h-12 md:w-12 md:h-16 text-xl md:text-3xl", 
    // 17 tiles max width calculation: 100vw / 17 ~= 5.8vw. 
    // Increased height ratio for better look.
    xl: "w-[5.5vw] h-[8.5vw] md:w-[3.5rem] md:h-[5rem] text-lg md:text-5xl max-w-[45px] max-h-[64px] md:max-w-none md:max-h-none", 
  };

  const baseClasses = `
    relative flex items-center justify-center 
    rounded-[2px] md:rounded-md shadow-md border border-gray-300 select-none cursor-pointer
    transition-transform duration-150
    ${sizeClasses[size]}
    ${isSelected ? '-translate-y-2 md:-translate-y-4 shadow-lg ring-2 ring-yellow-400' : ''}
    ${isSideways ? 'rotate-90' : ''}
    ${className}
  `;

  const colorClass = 
    tile.suit === Suit.Man ? 'text-red-600' :
    tile.suit === Suit.Pin ? 'text-blue-600' :
    tile.suit === Suit.Sou ? 'text-green-700' :
    tile.suit === Suit.Dragon && tile.value === 1 ? 'text-red-600' : // Red Dragon
    tile.suit === Suit.Dragon && tile.value === 2 ? 'text-green-600' : // Green Dragon
    tile.suit === Suit.Dragon && tile.value === 3 ? 'text-blue-800' : // White Dragon
    'text-black'; // Winds

  if (isHidden) {
    return (
      <div className={`${baseClasses} bg-green-700 border-green-900`}>
        {/* Back of tile pattern */}
        <div className="w-3/4 h-3/4 rounded bg-green-600 opacity-50"></div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} bg-slate-50 hover:bg-white`}
      onClick={onClick}
    >
      <span className={`${colorClass} font-serif leading-none font-bold`}>
        {tile.symbol}
      </span>
      {/* 3D effect at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] md:h-1 bg-gray-300 rounded-b-[2px] md:rounded-b-md"></div>
    </div>
  );
};

export default TileComponent;