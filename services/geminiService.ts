import { GoogleGenAI } from "@google/genai";
import { Tile } from "../types";
import { formatHandForAI } from "../utils/mahjongLogic";

export const getMahjongAdvice = async (
  hand: Tile[],
  discards: Tile[],
  lastDrawn: Tile | null
): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
      return "API Key not configured.";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const handStr = formatHandForAI(hand);
    const lastDrawnStr = lastDrawn ? lastDrawn.name : "None";
    
    const recentDiscards = discards.slice(-10).map(t => t.name).join(', ');

    const prompt = `
      You are a master of Taiwan Mahjong (16-tile variation).
      
      Context:
      - Hand size is 16 tiles (winning with 17).
      - Winning requires 5 sets (sequences/triplets) and 1 pair.
      
      My current hand: [${handStr}].
      I just drew: ${lastDrawnStr}.
      Recent discards on table: [${recentDiscards}].
      
      Task:
      Analyze the hand efficiency. Which tile should I discard?
      Briefly explain why in 2 sentences (in Traditional Chinese), focusing on efficiency and potential melds.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "目前無法判斷";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "連線錯誤，請檢查網路或 API Key";
  }
};