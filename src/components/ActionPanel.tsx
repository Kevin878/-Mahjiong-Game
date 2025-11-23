import React from 'react';
import { ActionType } from '../../shared/types';

interface ActionPanelProps {
  onAction: (action: ActionType) => void;
  availableActions: ActionType[];
}

const ActionPanel: React.FC<ActionPanelProps> = ({ 
  onAction,
  availableActions,
}) => {
  // If no interrupt actions are available, render nothing
  if (availableActions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 m-4 flex flex-col gap-4 items-end z-50 w-full pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end gap-4 pr-4">
        
        {/* Main Interaction Buttons */}
        <div className="flex flex-wrap justify-end gap-3 pb-2">
          
          {/* Interrupt Actions (Chi/Pong/Kong/Hu/Pass) */}
           <>
              {availableActions.includes(ActionType.Hu) && (
                <button onClick={() => onAction(ActionType.Hu)} className="px-8 py-4 rounded-lg font-extrabold text-2xl shadow-xl bg-red-600 text-white hover:bg-red-500 hover:scale-110 transition-all border-2 border-red-400 animate-bounce">
                  胡!
                </button>
              )}
              
              {availableActions.includes(ActionType.Kong) && (
                <button onClick={() => onAction(ActionType.Kong)} className="px-6 py-3 rounded-lg font-bold text-xl shadow-lg bg-yellow-600 text-white hover:bg-yellow-500 hover:-translate-y-1 transition-all">
                  槓
                </button>
              )}

              {availableActions.includes(ActionType.AnKong) && (
                <button onClick={() => onAction(ActionType.AnKong)} className="px-6 py-3 rounded-lg font-bold text-xl shadow-lg bg-purple-600 text-white hover:bg-purple-500 hover:-translate-y-1 transition-all">
                  暗槓
                </button>
              )}

              {availableActions.includes(ActionType.BuKong) && (
                <button onClick={() => onAction(ActionType.BuKong)} className="px-6 py-3 rounded-lg font-bold text-xl shadow-lg bg-orange-600 text-white hover:bg-orange-500 hover:-translate-y-1 transition-all">
                  補槓
                </button>
              )}

              {availableActions.includes(ActionType.Pong) && (
                <button onClick={() => onAction(ActionType.Pong)} className="px-6 py-3 rounded-lg font-bold text-xl shadow-lg bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-1 transition-all">
                  碰
                </button>
              )}

              {availableActions.includes(ActionType.Chi) && (
                <button onClick={() => onAction(ActionType.Chi)} className="px-6 py-3 rounded-lg font-bold text-xl shadow-lg bg-green-600 text-white hover:bg-green-500 hover:-translate-y-1 transition-all">
                  吃
                </button>
              )}

              <button onClick={() => onAction(ActionType.Pass)} className="px-6 py-3 rounded-lg font-bold text-lg shadow-lg bg-gray-500 text-white hover:bg-gray-400 transition-all">
                略過
              </button>
           </>
        </div>
      </div>
    </div>
  );
};

export default ActionPanel;