# 專案所使用的 AI 工具

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://i.ytimg.com/vi/Kd0QGZMy_tA/maxresdefault.jpg" />
</div>

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 麻將線上對戰（繁體中文說明）

這是一個使用 React + Vite 的前端，以及 Node.js/Express/Socket.IO 的後端，實作四人麻將對戰的專案。前端提供桌面/平板瀏覽介面，後端管理房間、出牌流程、吃碰槓胡等規則。

## 功能與規則
- 四人房間（滿 4 人自動開局，名稱不可重複）。
- 出牌、吃、碰、明槓、暗槓、自摸、榮和、流局判斷。
- 任何玩家斷線，房間內其他玩家會被強制斷線並移除房間（依照目前設定）。
- 最新摸到的牌會在手牌最右側並留出間隔，方便辨識。
- 結束畫面會顯示勝利玩家暱稱。

## 環境需求
- Node.js 18+（建議 LTS）
- npm

## 專案結構
```
Mahjiong-Game/
├─ package.json            # 前端 (Vite)
├─ src/                    # React 前端
├─ server/                 # Node/Express/Socket.IO 後端
├─ shared/                 # 前後端共用型別與邏輯
└─ 
```

## 安裝與啟動
1. 安裝前端依賴（根目錄）：
   ```bash
   npm install
   ```
2. 安裝後端依賴：
   ```bash
   cd server
   npm install
   ```
3. 啟動後端（預設 3001，綁定 0.0.0.0 供區網連線）：
   ```bash
   npm start
   ```
4. 回到根目錄啟動前端開發伺服器（預設 3000）：
   ```bash
   npm run dev
   ```
5. 在瀏覽器輸入：
   ```
   http://<開發者的機器內網IP>:3000
   ```
   同一區網的裝置可直接連線。前端會自動連到 `http://<你的機器內網IP>:3001`。

> 若防火牆阻擋，請放行 TCP 3000/3001；或改用其他埠並同步調整 `server/index.ts` 與 `src/App.tsx` 的埠號。

## 使用方式
1. 每位玩家輸入暱稱與相同的房間號碼，按「加入房間」。
2. 滿 4 人後伺服器自動開局。
3. 出牌：雙擊手牌即可出牌；若能吃碰槓胡，畫面中央提示會顯示等待操作，按按鈕執行。
4. 遊戲結束後可按「Play Again」重新開局（需 4 人在線）。

## 重要設定
- 連線主機：`server/index.ts` 中 `HOST='0.0.0.0'`，`PORT=3001`。
- 前端 Socket URL：`src/App.tsx` 以 `window.location.hostname:3001` 連線。
- 名稱唯一：同房內暱稱不可重複，否則會收到錯誤訊息。
- 斷線策略：任何一人離線，房間即被移除並踢除其餘玩家。

## 開發注意
- 前後端共用的型別與麻將邏輯在 `shared/` 目錄，若更新邏輯請同步前後端。
- Tailwind 已透過 PostCSS 整合；樣式入口為 `src/index.css`。

## 授權
請依字型專案（Masafont）原始授權遵循其條款。程式碼如需重新授權請自行補充。*** End Patch*** разингтон to=functions.apply_patch  concierge json अप(Note: no trailing end_patch newline)
