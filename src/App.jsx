import { useState, useEffect, useCallback, useReducer } from "react";

// ═══════════════════════════════════════════════════
// GAME DATA
// ═══════════════════════════════════════════════════
const CLASSES = {
  FE: { name: "FE", hp: 90, mp: 50, atk: 14, def: 8, crt: 15, skill: { name: "핫 리로드", cost: 25, desc: "HP 25% 회복 + 디버프 해제" } },
  BE: { name: "BE", hp: 120, mp: 30, atk: 16, def: 10, crt: 5, skill: { name: "500 에러", cost: 20, desc: "ATK 200% 데미지, 자신 HP 10% 감소" } },
  DevOps: { name: "DevOps", hp: 100, mp: 40, atk: 10, def: 14, crt: 8, skill: { name: "오토스케일링", cost: 20, desc: "DEF 2배 3턴" } },
  QA: { name: "QA", hp: 85, mp: 45, atk: 12, def: 10, crt: 20, skill: { name: "버그 리포트", cost: 25, desc: "다음 3회 공격 크리티컬 확정" } },
};

const ENEMIES = [
  { name: "떨어진 V2", hp: 20, atk: 6, def: 3, crt: 5, exp: 15, gold: 10, minFloor: 1, ability: null },
  { name: "고장난 T1", hp: 35, atk: 10, def: 5, crt: 8, exp: 25, gold: 15, minFloor: 1, ability: "enrage" },
  { name: "야근 귀신", hp: 50, atk: 14, def: 6, crt: 12, exp: 40, gold: 25, minFloor: 2, ability: "mpDrain" },
  { name: "감사팀", hp: 70, atk: 12, def: 12, crt: 10, exp: 60, gold: 40, minFloor: 3, ability: "atkDebuff" },
];

const ITEMS = {
  consume: [
    { name: "커피 ☕", type: "소모품", rarity: "일반", effect: { hp: 20 }, desc: "HP +20", price: 15 },
    { name: "에너지드링크 ⚡", type: "소모품", rarity: "일반", effect: { mp: 15 }, desc: "MP +15", price: 15 },
    { name: "야식 🍜", type: "소모품", rarity: "고급", effect: { hp: 40 }, desc: "HP +40", price: 30 },
    { name: "포스트잇 📝", type: "소모품", rarity: "일반", effect: { hp: 10 }, desc: "HP +10", price: 8 },
  ],
  weapon: [
    { name: "기계식 키보드 ⌨", type: "무기", rarity: "일반", effect: { atk: 3 }, desc: "ATK +3", price: 25 },
    { name: "울트라와이드 모니터 🖥", type: "무기", rarity: "고급", effect: { atk: 5 }, desc: "ATK +5", price: 50 },
    { name: "맥북 프로 💻", type: "무기", rarity: "희귀", effect: { atk: 8 }, desc: "ATK +8", price: 80 },
  ],
  armor: [
    { name: "후드티 🧥", type: "방어구", rarity: "일반", effect: { def: 3 }, desc: "DEF +3", price: 25 },
    { name: "노이즈캔슬링 🎧", type: "방어구", rarity: "고급", effect: { def: 5 }, desc: "DEF +5", price: 50 },
    { name: "재택근무권 🏠", type: "방어구", rarity: "희귀", effect: { def: 8 }, desc: "DEF +8", price: 80 },
  ],
  accessory: [
    { name: "깃허브 스티커 🏷", type: "장신구", rarity: "일반", effect: { crt: 5 }, desc: "CRT +5%", price: 30 },
    { name: "스택오버플로우 rep 🏆", type: "장신구", rarity: "고급", effect: { crt: 8 }, desc: "CRT +8%", price: 55 },
  ],
};

const EVENTS = [
  { text: "자판기에서 커피가 공짜로 나왔다!", effect: { hp: 15 } },
  { text: "슬랙 알림 폭탄! 정신이 혼미해진다...", effect: { mp: -10 } },
  { text: "바닥에 골드카드를 발견했다!", effect: { gold: 20 } },
  { text: "갑자기 스프린트 미팅이 소집됐다! HP가 감소한다.", effect: { hp: -15 } },
  { text: "동료가 간식을 나눠줬다!", effect: { hp: 25 } },
  { text: "코드 리뷰에서 칭찬을 받았다! MP가 회복된다.", effect: { mp: 20 } },
  { text: "배포 직전 서버가 터졌다! 충격으로 HP가 줄었다.", effect: { hp: -20 } },
  { text: "사수가 커피를 사줬다!", effect: { hp: 10, mp: 10 } },
];

// ═══════════════════════════════════════════════════
// MAP GENERATION
// ═══════════════════════════════════════════════════
const GRID = 8;
const CELL_TYPES = { EMPTY: 0, WALL: 1, ENEMY: 2, ITEM: 3, EVENT: 4, SHOP: 5, KEY: 6, EXIT: 7, PLAYER: 8 };

function generateMap(floor) {
  const map = Array.from({ length: GRID }, () => Array(GRID).fill(CELL_TYPES.EMPTY));
  const revealed = Array.from({ length: GRID }, () => Array(GRID).fill(false));

  // Place walls (roughly 20-30% of cells)
  const wallCount = 12 + Math.floor(Math.random() * 5);
  let placed = 0;
  while (placed < wallCount) {
    const r = Math.floor(Math.random() * GRID);
    const c = Math.floor(Math.random() * GRID);
    if (r === 0 && c === 0) continue;
    if (map[r][c] === CELL_TYPES.EMPTY) { map[r][c] = CELL_TYPES.WALL; placed++; }
  }

  // Ensure player start is clear
  map[0][0] = CELL_TYPES.EMPTY;

  // Place special cells
  const placeRandom = (type, count = 1) => {
    let p = 0;
    while (p < count) {
      const r = Math.floor(Math.random() * GRID);
      const c = Math.floor(Math.random() * GRID);
      if (map[r][c] === CELL_TYPES.EMPTY && !(r === 0 && c === 0)) { map[r][c] = type; p++; }
    }
  };

  const enemyCount = 3 + Math.min(floor, 3);
  placeRandom(CELL_TYPES.ENEMY, enemyCount);
  placeRandom(CELL_TYPES.ITEM, 2);
  placeRandom(CELL_TYPES.EVENT, 2);
  placeRandom(CELL_TYPES.KEY, 1);
  placeRandom(CELL_TYPES.EXIT, 1);
  if (Math.random() < 0.5) placeRandom(CELL_TYPES.SHOP, 1);

  // BFS 검증 (2단계)
  // 1단계: 출구를 벽으로 취급하고 열쇠 + 기타 셀 도달 가능 여부 확인
  //   (열쇠 없이는 출구를 통과할 수 없으므로, 열쇠는 출구를 거치지 않고 도달 가능해야 함)
  // 2단계: 전체 BFS로 출구 도달 가능 여부 확인
  const bfs = (blockType) => {
    const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    const q = [[0, 0]];
    visited[0][0] = true;
    while (q.length > 0) {
      const [cr, cc] = q.shift();
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !visited[nr][nc]
            && map[nr][nc] !== CELL_TYPES.WALL && map[nr][nc] !== blockType) {
          visited[nr][nc] = true;
          q.push([nr, nc]);
        }
      }
    }
    return visited;
  };

  // 1단계: 출구를 막고 BFS → 열쇠 및 기타 셀(적, 아이템, 이벤트, 상점)이 도달 가능해야 함
  const reachNoExit = bfs(CELL_TYPES.EXIT);
  let valid = true;
  for (let r = 0; r < GRID && valid; r++) {
    for (let c = 0; c < GRID && valid; c++) {
      const t = map[r][c];
      if (t !== CELL_TYPES.EMPTY && t !== CELL_TYPES.WALL && t !== CELL_TYPES.EXIT && !reachNoExit[r][c]) {
        valid = false;
      }
    }
  }

  // 2단계: 일반 BFS → 출구도 도달 가능해야 함
  if (valid) {
    const reachAll = bfs(null);
    for (let r = 0; r < GRID && valid; r++) {
      for (let c = 0; c < GRID && valid; c++) {
        if (map[r][c] === CELL_TYPES.EXIT && !reachAll[r][c]) {
          valid = false;
        }
      }
    }
  }

  if (!valid) {
    return generateMap(floor);
  }

  // Reveal around player start
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = 0 + dr, nc = 0 + dc;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) revealed[nr][nc] = true;
    }
  }

  return { map, revealed, playerPos: [0, 0], hasKey: false };
}

function getEnemyForFloor(floor) {
  const available = ENEMIES.filter(e => floor >= e.minFloor);
  const base = { ...available[Math.floor(Math.random() * available.length)] };
  const scale = 1 + (floor - 1) * 0.15;
  return { ...base, hp: Math.floor(base.hp * scale), maxHp: Math.floor(base.hp * scale), atk: Math.floor(base.atk * scale), def: Math.floor(base.def * scale), exp: Math.floor(base.exp * scale), gold: Math.floor(base.gold * scale) };
}

function getRandomItem() {
  const allItems = [...ITEMS.consume, ...ITEMS.weapon, ...ITEMS.armor, ...ITEMS.accessory];
  return { ...allItems[Math.floor(Math.random() * allItems.length)] };
}

function getRandomConsumable() {
  return { ...ITEMS.consume[Math.floor(Math.random() * ITEMS.consume.length)] };
}

// 레벨업 시 선택 가능한 스탯 보너스 풀
const LEVEL_UP_OPTIONS = [
  { label: "HP +10", stat: "maxHp", value: 10, desc: "최대 체력 증가" },
  { label: "MP +8", stat: "maxMp", value: 8, desc: "최대 마력 증가" },
  { label: "ATK +3", stat: "atk", value: 3, desc: "공격력 증가" },
  { label: "DEF +3", stat: "def", value: 3, desc: "방어력 증가" },
  { label: "CRT +5%", stat: "crt", value: 5, desc: "치명타 확률 증가" },
];

function generateLevelUpChoices() {
  // 5개 풀에서 랜덤 3개 선택
  const shuffled = [...LEVEL_UP_OPTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ═══════════════════════════════════════════════════
// RANKING SYSTEM
// ═══════════════════════════════════════════════════
const RANKING_KEY = "cell-dungeon-ranking";
const MAX_RANKINGS = 10;

function calcScore(floor, level, turn, gold) {
  // 높은 층 + 높은 레벨 = 높은 점수, 적은 턴 = 보너스
  return (floor * 1000) + (level * 200) + gold + Math.max(0, 500 - turn);
}

function getRankings() {
  try {
    const data = localStorage.getItem(RANKING_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveRanking(entry) {
  const rankings = getRankings();
  rankings.push(entry);
  rankings.sort((a, b) => b.score - a.score);
  const top = rankings.slice(0, MAX_RANKINGS);
  localStorage.setItem(RANKING_KEY, JSON.stringify(top));
  return top;
}

// ═══════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════
const initState = () => ({
  screen: "title", // title | classSelect | game | gameOver | ranking
  player: null,
  dungeon: null,
  floor: 1,
  turn: 0,
  battleLog: "",
  activeTab: "Sheet1",
  modal: null, // { type: 'battle' | 'event', ... }
  shopItems: [],
  shopActive: false,
  purchaseHistory: [],
});

// ═══════════════════════════════════════════════════
// GAME REDUCER
// ═══════════════════════════════════════════════════
function gameReducer(state, action) {
  switch (action.type) {
    case "START_GAME": {
      const cls = CLASSES[action.classKey];
      const dungeon = generateMap(1);
      return {
        ...state,
        screen: "game",
        player: {
          name: action.nickname || "플레이어",
          class: action.classKey,
          level: 1,
          hp: cls.hp, maxHp: cls.hp,
          mp: cls.mp, maxMp: cls.mp,
          atk: cls.atk, def: cls.def, crt: cls.crt,
          exp: 0, expNext: 100,
          gold: 0,
          skill: cls.skill,
          inventory: [{ ...ITEMS.consume[0] }], // Start with a coffee
          equipped: { "무기": null, "방어구": null, "장신구": null },
          buffs: { defMultiplier: 1, defTurns: 0, critGuaranteed: 0, atkDebuff: 0 },
        },
        dungeon,
        floor: 1,
        turn: 0,
        battleLog: "던전에 입장했다!",
        activeTab: "Sheet1",
        modal: null,
        shopItems: [],
        shopActive: false,
        purchaseHistory: [],
      };
    }

    case "MOVE": {
      if (state.modal || state.screen !== "game" || state.activeTab !== "Sheet1") return state;
      const { dr, dc } = action;
      const [pr, pc] = state.dungeon.playerPos;
      const nr = pr + dr, nc = pc + dc;
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return state;

      const cellType = state.dungeon.map[nr][nc];
      if (cellType === CELL_TYPES.WALL) return state;

      // Reveal fog
      const newRevealed = state.dungeon.revealed.map(r => [...r]);
      for (let ddr = -1; ddr <= 1; ddr++) {
        for (let ddc = -1; ddc <= 1; ddc++) {
          const rr = nr + ddr, rc = nc + ddc;
          if (rr >= 0 && rr < GRID && rc >= 0 && rc < GRID) newRevealed[rr][rc] = true;
        }
      }

      const newMap = state.dungeon.map.map(r => [...r]);
      const newTurn = state.turn + 1;
      let newPlayer = { ...state.player, buffs: { ...state.player.buffs } };
      let modal = null;
      let log = state.battleLog;
      let newShopActive = state.shopActive;
      let newShopItems = state.shopItems;
      let hasKey = state.dungeon.hasKey;

      // Tick down buffs
      if (newPlayer.buffs.defTurns > 0) {
        newPlayer.buffs.defTurns--;
        if (newPlayer.buffs.defTurns === 0) newPlayer.buffs.defMultiplier = 1;
      }
      if (newPlayer.buffs.atkDebuff > 0) newPlayer.buffs.atkDebuff--;

      switch (cellType) {
        case CELL_TYPES.ENEMY: {
          const enemy = getEnemyForFloor(state.floor);
          modal = { type: "battle", enemy, log: [`> ${enemy.name}이(가) 나타났다!`], playerTurn: true };
          log = `전투: ${enemy.name}이(가) 나타났다!`;
          break;
        }
        case CELL_TYPES.ITEM: {
          const item = getRandomItem();
          if (newPlayer.inventory.length < 20) {
            newPlayer.inventory = [...newPlayer.inventory, item];
            modal = { type: "event", text: `${item.name} 을(를) 획득했다!` };
            log = `${item.name} 획득!`;
          } else {
            modal = { type: "event", text: "인벤토리가 가득 찼다!" };
            log = "인벤토리 가득!";
          }
          newMap[nr][nc] = CELL_TYPES.EMPTY;
          break;
        }
        case CELL_TYPES.EVENT: {
          const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
          if (evt.effect.hp) newPlayer.hp = Math.max(1, Math.min(newPlayer.maxHp, newPlayer.hp + evt.effect.hp));
          if (evt.effect.mp) newPlayer.mp = Math.max(0, Math.min(newPlayer.maxMp, newPlayer.mp + evt.effect.mp));
          if (evt.effect.gold) newPlayer.gold += evt.effect.gold;
          modal = { type: "event", text: evt.text };
          log = evt.text;
          newMap[nr][nc] = CELL_TYPES.EMPTY;
          break;
        }
        case CELL_TYPES.SHOP: {
          newShopActive = true;
          const allBuyable = [...ITEMS.consume, ...ITEMS.weapon, ...ITEMS.armor, ...ITEMS.accessory];
          newShopItems = [];
          const indices = new Set();
          while (newShopItems.length < 4 && indices.size < allBuyable.length) {
            const idx = Math.floor(Math.random() * allBuyable.length);
            if (!indices.has(idx)) { indices.add(idx); newShopItems.push({ ...allBuyable[idx] }); }
          }
          modal = { type: "shop", items: newShopItems };
          log = "상점 발견!";
          newMap[nr][nc] = CELL_TYPES.EMPTY;
          break;
        }
        case CELL_TYPES.KEY: {
          hasKey = true;
          modal = { type: "event", text: "열쇠를 획득했다! 출구로 향하자!" };
          log = "열쇠를 획득했다! 출구로 향하자!";
          newMap[nr][nc] = CELL_TYPES.EMPTY;
          break;
        }
        case CELL_TYPES.EXIT: {
          if (!hasKey) {
            modal = { type: "event", text: "잠겨있다... 열쇠가 필요하다." };
            log = "출구가 잠겨있다. 열쇠를 찾아야 한다.";
            return { ...state, dungeon: { ...state.dungeon, revealed: newRevealed }, turn: newTurn, battleLog: log, modal };
          }
          // Go to next floor
          const nextFloor = state.floor + 1;
          const newDungeon = generateMap(nextFloor);
          modal = { type: "event", text: `${nextFloor}F에 도착했다!` };
          return {
            ...state,
            dungeon: newDungeon,
            floor: nextFloor,
            turn: newTurn,
            battleLog: `${nextFloor}F 도착!`,
            modal,
            player: newPlayer,
            shopActive: false,
            shopItems: [],
          };
        }
        default: break;
      }

      const newDungeon = {
        ...state.dungeon,
        map: newMap,
        revealed: newRevealed,
        playerPos: cellType === CELL_TYPES.ENEMY ? state.dungeon.playerPos : [nr, nc],
        hasKey,
      };
      // If not battle, move to new cell
      if (cellType !== CELL_TYPES.ENEMY) {
        newDungeon.playerPos = [nr, nc];
      } else {
        // Move into enemy cell after battle resolves
        newDungeon.pendingMove = [nr, nc];
      }

      return { ...state, dungeon: newDungeon, turn: newTurn, player: newPlayer, battleLog: log, modal, shopActive: newShopActive, shopItems: newShopItems };
    }

    case "BATTLE_ACTION": {
      if (!state.modal || state.modal.type !== "battle") return state;
      const { actionType } = action;
      let enemy = { ...state.modal.enemy };
      let player = { ...state.player, buffs: { ...state.player.buffs } };
      let logs = [...state.modal.log];
      let battleOver = false;
      let victory = false;

      const effectiveAtk = player.atk * (player.buffs.atkDebuff > 0 ? 0.8 : 1) +
        (player.equipped["무기"] ? player.equipped["무기"].effect.atk : 0);
      const effectiveDef = player.def * player.buffs.defMultiplier +
        (player.equipped["방어구"] ? player.equipped["방어구"].effect.def : 0);
      const effectiveCrt = player.crt +
        (player.equipped["장신구"] ? (player.equipped["장신구"].effect.crt || 0) : 0);

      if (actionType === "attack") {
        const isCrit = player.buffs.critGuaranteed > 0 || Math.random() * 100 < effectiveCrt;
        if (player.buffs.critGuaranteed > 0) player.buffs.critGuaranteed--;
        const dmg = Math.max(1, Math.floor(effectiveAtk * (isCrit ? 1.8 : 1) - enemy.def));
        enemy.hp = Math.max(0, enemy.hp - dmg);
        logs.push(`> 공격! ${dmg} 데미지!${isCrit ? " 크리티컬!" : ""}`);
      } else if (actionType === "skill") {
        const skill = CLASSES[player.class].skill;
        if (player.mp < skill.cost) {
          logs.push(`> MP가 부족하다! (필요: ${skill.cost})`);
          return { ...state, modal: { ...state.modal, log: logs } };
        }
        player.mp -= skill.cost;
        switch (player.class) {
          case "FE":
            player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.25));
            player.buffs.atkDebuff = 0;
            player.buffs.defMultiplier = Math.max(1, player.buffs.defMultiplier);
            logs.push(`> 핫 리로드! HP 25% 회복 + 디버프 해제!`);
            break;
          case "BE": {
            const dmg = Math.max(1, Math.floor(effectiveAtk * 2 - enemy.def));
            enemy.hp = Math.max(0, enemy.hp - dmg);
            const selfDmg = Math.floor(player.maxHp * 0.1);
            player.hp = Math.max(1, player.hp - selfDmg);
            logs.push(`> 500 에러! ${dmg} 데미지! (반동 ${selfDmg})`);
            break;
          }
          case "DevOps":
            player.buffs.defMultiplier = 2;
            player.buffs.defTurns = 3;
            logs.push(`> 오토스케일링! DEF 2배 3턴!`);
            break;
          case "QA":
            player.buffs.critGuaranteed = 3;
            logs.push(`> 버그 리포트! 다음 3회 공격 크리티컬 확정!`);
            break;
        }
      } else if (actionType === "item") {
        // 아이템 선택 모드 토글
        if (action.itemIndex === undefined) {
          const consumables = player.inventory.filter(i => i.type === "소모품");
          if (consumables.length === 0) {
            logs.push("> 사용할 소모품이 없다!");
            return { ...state, modal: { ...state.modal, log: logs } };
          }
          return { ...state, modal: { ...state.modal, log: logs, showItemSelect: true } };
        }
        // 선택된 아이템 사용
        const item = player.inventory[action.itemIndex];
        if (!item || item.type !== "소모품") return state;
        if (item.effect.hp) player.hp = Math.min(player.maxHp, player.hp + item.effect.hp);
        if (item.effect.mp) player.mp = Math.min(player.maxMp, player.mp + item.effect.mp);
        player.inventory = [...player.inventory];
        player.inventory.splice(action.itemIndex, 1);
        logs.push(`> ${item.name} 사용! ${item.desc}`);
      } else if (actionType === "cancelItem") {
        return { ...state, modal: { ...state.modal, showItemSelect: false } };
      } else if (actionType === "flee") {
        if (Math.random() < 0.5) {
          logs.push("> 도주 성공!");
          return {
            ...state,
            player,
            modal: null,
            battleLog: "도주 성공!",
          };
        } else {
          logs.push("> 도주 실패!");
        }
      }

      // Check enemy death
      if (enemy.hp <= 0) {
        battleOver = true;
        victory = true;
        logs.push(`> ${enemy.name}을(를) 처치했다!`);
      }

      // Enemy turn (if not dead and player didn't just flee)
      if (!battleOver && actionType !== "flee") {
        // Enemy ability
        if (enemy.ability === "enrage" && enemy.hp < enemy.maxHp * 0.5) {
          const atkBoost = Math.floor(enemy.atk * 0.2);
          enemy.atk += atkBoost;
          logs.push(`> ${enemy.name}의 경보가 울린다! ATK 상승!`);
        }
        if (enemy.ability === "mpDrain") {
          player.mp = Math.max(0, player.mp - 5);
          logs.push(`> 야근 저주! MP -5`);
        }
        if (enemy.ability === "atkDebuff" && state.turn % 2 === 0) {
          player.buffs.atkDebuff = 2;
          logs.push(`> 감사 지적! ATK 20% 감소 디버프!`);
        }

        const enemyCrit = Math.random() * 100 < enemy.crt;
        const eDmg = Math.max(1, Math.floor(enemy.atk * (enemyCrit ? 1.5 : 1) - effectiveDef));
        player.hp = Math.max(0, player.hp - eDmg);
        logs.push(`> ${enemy.name}의 공격! ${eDmg} 데미지!${enemyCrit ? " 크리티컬!" : ""}`);

        if (player.hp <= 0) {
          battleOver = true;
          victory = false;
          logs.push("> 쓰러졌다...");
        }
      }

      if (battleOver && victory) {
        // Give rewards
        player.exp += enemy.exp;
        player.gold += enemy.gold;
        // Drop item chance
        let dropItem = null;
        if (Math.random() < 0.4) {
          dropItem = getRandomConsumable();
          if (player.inventory.length < 20) player.inventory = [...player.inventory, dropItem];
        }
        // 레벨업 체크 — 경험치 초과 시 레벨업 모달 예약
        let pendingLevelUp = null;
        if (player.exp >= player.expNext) {
          player.level++;
          player.exp -= player.expNext;
          player.expNext = Math.floor(player.expNext * 1.5);
          player.hp = player.maxHp;
          player.mp = player.maxMp;
          pendingLevelUp = generateLevelUpChoices();
          logs.push(`> 레벨 업! Lv.${player.level}!`);
        }

        const rewardText = `EXP +${enemy.exp} | Gold +${enemy.gold}${dropItem ? ` | ${dropItem.name}` : ""}`;

        // Clear enemy from map and move player
        const newMap = state.dungeon.map.map(r => [...r]);
        const pendingMove = state.dungeon.pendingMove;
        if (pendingMove) {
          newMap[pendingMove[0]][pendingMove[1]] = CELL_TYPES.EMPTY;
        }

        return {
          ...state,
          player,
          modal: { type: "battle", enemy, log: logs, playerTurn: false, result: "victory", reward: rewardText, pendingLevelUp },
          dungeon: { ...state.dungeon, map: newMap, pendingMove },
          battleLog: `승리! ${rewardText}`,
        };
      }

      if (battleOver && !victory) {
        return { ...state, player, modal: { type: "battle", enemy, log: logs, playerTurn: false, result: "defeat" }, battleLog: "패배..." };
      }

      return { ...state, player, modal: { ...state.modal, enemy, log: logs, playerTurn: true } };
    }

    case "CLOSE_MODAL": {
      if (state.modal?.result === "defeat") {
        const p = state.player;
        const score = calcScore(state.floor, p.level, state.turn, p.gold);
        saveRanking({ name: p.name, class: p.class, level: p.level, floor: state.floor, turn: state.turn, gold: p.gold, score, date: new Date().toLocaleDateString("ko-KR") });
        return { ...initState(), screen: "gameOver", player: state.player, floor: state.floor, turn: state.turn };
      }
      if (state.modal?.result === "victory") {
        const pendingMove = state.dungeon.pendingMove;
        const newDungeon = { ...state.dungeon, pendingMove: null };
        if (pendingMove) newDungeon.playerPos = pendingMove;
        // 레벨업 선택이 대기 중이면 레벨업 모달 표시
        if (state.modal.pendingLevelUp) {
          return { ...state, modal: { type: "levelUp", choices: state.modal.pendingLevelUp }, dungeon: newDungeon };
        }
        return { ...state, modal: null, dungeon: newDungeon };
      }
      return { ...state, modal: null };
    }

    case "LEVEL_UP_CHOOSE": {
      // 선택한 스탯 적용
      const { stat, value } = action.choice;
      let player = { ...state.player };
      player[stat] = (player[stat] || 0) + value;
      // maxHp/maxMp 증가 시 현재 HP/MP도 회복
      if (stat === "maxHp") player.hp = player.maxHp;
      if (stat === "maxMp") player.mp = player.maxMp;
      return { ...state, player, modal: null, battleLog: `레벨업 보너스: ${action.choice.label}` };
    }

    case "SET_TAB":
      return { ...state, activeTab: action.tab };

    case "USE_ITEM": {
      const item = action.item;
      let player = { ...state.player, inventory: [...state.player.inventory] };
      if (item.type === "소모품") {
        if (item.effect.hp) player.hp = Math.min(player.maxHp, player.hp + item.effect.hp);
        if (item.effect.mp) player.mp = Math.min(player.maxMp, player.mp + item.effect.mp);
        const idx = player.inventory.findIndex(i => i.name === item.name);
        if (idx >= 0) player.inventory.splice(idx, 1);
        return { ...state, player, battleLog: `${item.name} 사용!` };
      }
      if (["무기", "방어구", "장신구"].includes(item.type)) {
        const slot = item.type;
        const prev = player.equipped[slot];
        player.equipped = { ...player.equipped, [slot]: item };
        const idx = player.inventory.findIndex(i => i.name === item.name);
        if (idx >= 0) player.inventory.splice(idx, 1);
        if (prev) player.inventory.push(prev);
        return { ...state, player, battleLog: `${item.name} 장착!` };
      }
      return state;
    }

    case "BUY_ITEM": {
      const item = action.item;
      let player = { ...state.player, inventory: [...state.player.inventory] };
      if (player.gold < item.price) return { ...state, battleLog: "골드가 부족하다!" };
      if (player.inventory.length >= 20) return { ...state, battleLog: "인벤토리가 가득 찼다!" };
      player.gold -= item.price;
      player.inventory.push({ ...item });
      const record = { name: item.name, type: item.type, rarity: item.rarity, desc: item.desc, price: item.price, floor: state.floor, turn: state.turn };
      return { ...state, player, purchaseHistory: [...state.purchaseHistory, record], battleLog: `${item.name} 구매!` };
    }

    case "RESET":
      return initState();

    default: return state;
  }
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const colors = {
  bg: "#ffffff",
  menuBg: "#f0f0f0",
  menuBorder: "#d0d0d0",
  cellBorder: "#e2e2e2",
  cellBg: "#ffffff",
  cellWall: "#d9d9d9",
  cellUnrevealed: "#f3f3f3",
  cellPlayer: "#e8f0fe",
  cellEnemy: "#fce8e6",
  cellItem: "#e6f4ea",
  cellEvent: "#fef7e0",
  cellShop: "#f3e8fd",
  cellKey: "#fff8e1",
  cellExit: "#e0f7fa",
  textPrimary: "#202124",
  textSecondary: "#5f6368",
  textLink: "#1a73e8",
  accent: "#1a73e8",
  danger: "#d93025",
  success: "#188038",
  warning: "#f9ab00",
  tabActive: "#ffffff",
  tabInactive: "#f0f0f0",
};

const S = {
  app: { fontFamily: "'Google Sans', Roboto, Arial, sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.textPrimary, fontSize: 13, userSelect: "none", overflow: "hidden" },
  menuBar: { display: "flex", alignItems: "center", gap: 2, padding: "4px 8px", background: colors.menuBg, borderBottom: `1px solid ${colors.menuBorder}`, fontSize: 13 },
  menuItem: { padding: "4px 8px", cursor: "default", borderRadius: 4 },
  toolbar: { display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderBottom: `1px solid ${colors.menuBorder}`, fontSize: 12, background: colors.bg },
  toolBtn: { padding: "4px 6px", cursor: "default", borderRadius: 4, border: "none", background: "transparent", fontSize: 13 },
  formulaBar: { display: "flex", alignItems: "center", padding: "2px 8px", borderBottom: `1px solid ${colors.menuBorder}`, fontSize: 12, background: colors.bg, minHeight: 28 },
  fxLabel: { color: colors.textSecondary, fontWeight: 500, marginRight: 8, fontStyle: "italic" },
  fxText: { flex: 1, color: colors.textPrimary },
  gridContainer: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden", position: "relative" },
  gridWrapper: { display: "flex", flexDirection: "column" },
  headerRow: { display: "flex" },
  headerCell: { width: 72, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: colors.textSecondary, fontWeight: 500, background: colors.menuBg, borderRight: `1px solid ${colors.cellBorder}`, borderBottom: `1px solid ${colors.cellBorder}` },
  rowHeader: { width: 32, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: colors.textSecondary, fontWeight: 500, background: colors.menuBg, borderRight: `1px solid ${colors.cellBorder}`, borderBottom: `1px solid ${colors.cellBorder}` },
  gridRow: { display: "flex" },
  cell: { width: 72, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, borderRight: `1px solid ${colors.cellBorder}`, borderBottom: `1px solid ${colors.cellBorder}`, overflow: "hidden", cursor: "default", transition: "background 0.15s" },
  tabs: { display: "flex", alignItems: "flex-end", padding: "0 8px", borderTop: `1px solid ${colors.menuBorder}`, background: colors.menuBg, gap: 2, paddingTop: 4 },
  tab: (active) => ({ padding: "6px 16px", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", borderRadius: "4px 4px 0 0", background: active ? colors.tabActive : colors.tabInactive, border: `1px solid ${colors.menuBorder}`, borderBottom: active ? `2px solid ${colors.accent}` : "1px solid transparent", color: active ? colors.textPrimary : colors.textSecondary }),
  statusBar: { display: "flex", alignItems: "center", gap: 16, padding: "4px 12px", fontSize: 11, color: colors.textSecondary, borderTop: `1px solid ${colors.menuBorder}`, background: colors.menuBg },
  dpad: { position: "absolute", right: 16, bottom: 16, display: "grid", gridTemplateColumns: "40px 40px 40px", gridTemplateRows: "40px 40px", gap: 2 },
  dpadBtn: { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: colors.menuBg, border: `1px solid ${colors.menuBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 16, color: colors.textSecondary },
  modal: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", zIndex: 100 },
  modalBox: { background: "#fff", borderRadius: 8, padding: 0, minWidth: 380, maxWidth: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: `1px solid ${colors.cellBorder}`, overflow: "hidden" },
  modalTitle: { padding: "12px 16px", fontWeight: 700, fontSize: 15, borderBottom: `1px solid ${colors.cellBorder}` },
  modalBody: { padding: "12px 16px" },
  modalFooter: { padding: "8px 16px", display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${colors.cellBorder}` },
  btn: (color = colors.accent) => ({ padding: "8px 20px", background: color, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }),
  btnOutline: { padding: "8px 16px", background: "#fff", color: colors.textPrimary, border: `1px solid ${colors.menuBorder}`, borderRadius: 4, cursor: "pointer", fontSize: 13 },
  hpBar: (pct, color) => ({ height: 8, background: `linear-gradient(to right, ${color} ${pct}%, #e0e0e0 ${pct}%)`, borderRadius: 4, marginBottom: 4 }),
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${colors.cellBorder}`, fontWeight: 600, background: colors.menuBg, color: colors.textSecondary, fontSize: 11 },
  td: { padding: "6px 8px", borderBottom: `1px solid ${colors.cellBorder}` },
};

// ═══════════════════════════════════════════════════
// CELL DISPLAY
// ═══════════════════════════════════════════════════
function getCellDisplay(cellType, isPlayer, revealed) {
  if (isPlayer) return { text: "▶", bg: colors.cellPlayer, color: colors.accent, fontWeight: 700 };
  if (!revealed) return { text: "", bg: colors.cellUnrevealed, color: "transparent" };
  switch (cellType) {
    case CELL_TYPES.WALL: return { text: "#####", bg: colors.cellWall, color: colors.textSecondary, fontSize: 11 };
    case CELL_TYPES.ENEMY: return { text: "=ERR()", bg: colors.cellEnemy, color: colors.danger, fontWeight: 600, fontSize: 11 };
    case CELL_TYPES.ITEM: return { text: "=ITEM()", bg: colors.cellItem, color: colors.success, fontSize: 11 };
    case CELL_TYPES.EVENT: return { text: "=RAND()", bg: colors.cellEvent, color: colors.warning, fontSize: 11 };
    case CELL_TYPES.SHOP: return { text: "$SHOP", bg: colors.cellShop, color: "#7b1fa2", fontWeight: 600, fontSize: 11 };
    case CELL_TYPES.KEY: return { text: "🔑", bg: colors.cellKey, fontSize: 16 };
    case CELL_TYPES.EXIT: return { text: "출구", bg: colors.cellExit, color: "#00838f", fontWeight: 700, fontSize: 11 };
    default: return { text: "", bg: colors.cellBg };
  }
}

// ═══════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════

function TitleScreen({ dispatch }) {
  return (
    <div style={{ ...S.app, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Spreadsheet Roguelike v0.1</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: colors.accent, margin: "0 0 32px" }}>Cell Dungeon</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
          <button onClick={() => dispatch({ type: "SET_SCREEN", screen: "classSelect" })} style={{ ...S.btn(), padding: "12px 24px", fontSize: 15 }}>1. 새 게임</button>
          <button onClick={() => dispatch({ type: "SET_SCREEN", screen: "ranking" })} style={{ ...S.btnOutline, padding: "12px 24px" }}>2. 랭킹</button>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 20, fontSize: 11, color: colors.textSecondary }}>Tony</div>
    </div>
  );
}

function ClassSelect({ dispatch }) {
  const [selected, setSelected] = useState("FE");
  const [nickname, setNickname] = useState("플레이어");
  const cls = CLASSES[selected];

  return (
    <div style={{ ...S.app, justifyContent: "center", alignItems: "center" }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>직업 선택</h2>
        <table style={S.table}>
          <thead>
            <tr>{["", "직업", "HP", "MP", "ATK", "DEF", "CRT", "스킬"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {Object.entries(CLASSES).map(([key, c]) => (
              <tr key={key} onClick={() => setSelected(key)} style={{ background: selected === key ? "#e8f0fe" : "transparent", cursor: "pointer" }}>
                <td style={S.td}>{selected === key ? "▶" : ""}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{c.name}</td>
                <td style={S.td}>{c.hp}</td>
                <td style={S.td}>{c.mp}</td>
                <td style={S.td}>{c.atk}</td>
                <td style={S.td}>{c.def}</td>
                <td style={S.td}>{c.crt}%</td>
                <td style={{ ...S.td, fontSize: 11, color: colors.textSecondary }}>{c.skill.name}: {c.skill.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>닉네임</label>
          <input value={nickname} onChange={e => setNickname(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px", border: `1px solid ${colors.menuBorder}`, borderRadius: 4, fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={() => dispatch({ type: "RESET" })} style={S.btnOutline}>뒤로</button>
          <button onClick={() => dispatch({ type: "START_GAME", classKey: selected, nickname })} style={S.btn()}>게임 시작</button>
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({ state, dispatch }) {
  const p = state.player;
  const score = p ? calcScore(state.floor, p.level, state.turn, p.gold) : 0;
  return (
    <div style={{ ...S.app, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, color: colors.danger, marginBottom: 8 }}>게임 오버</h1>
        <p style={{ color: colors.textSecondary, marginBottom: 4 }}>{p?.name} ({p?.class}) - Lv.{p?.level}</p>
        <p style={{ color: colors.textSecondary, marginBottom: 4 }}>{state.floor}층 | {state.turn}턴 | {p?.gold}G</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: colors.accent, marginBottom: 24 }}>점수: {score.toLocaleString()}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <button onClick={() => dispatch({ type: "SET_SCREEN", screen: "ranking" })} style={{ ...S.btnOutline, padding: "10px 24px" }}>랭킹 보기</button>
          <button onClick={() => dispatch({ type: "RESET" })} style={S.btn()}>타이틀로 돌아가기</button>
        </div>
      </div>
    </div>
  );
}

function RankingScreen({ dispatch }) {
  const rankings = getRankings();
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  return (
    <div style={{ ...S.app, justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", minWidth: 420 }}>
        <h1 style={{ fontSize: 24, color: colors.accent, marginBottom: 16 }}>랭킹 Top 10</h1>
        {rankings.length === 0 ? (
          <p style={{ color: colors.textSecondary, marginBottom: 24 }}>기록이 없습니다. 게임을 플레이해보세요!</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "center" }}>#</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "left" }}>이름</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "center" }}>직업</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "center" }}>Lv</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "center" }}>층</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "center" }}>턴</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "right" }}>점수</th>
                <th style={{ padding: "8px 4px", color: colors.textSecondary, textAlign: "right" }}>날짜</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.border}`, background: i < 3 ? `${medalColors[i]}11` : "transparent" }}>
                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 700, color: i < 3 ? medalColors[i] : colors.textSecondary }}>{i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}</td>
                  <td style={{ padding: "6px 4px", textAlign: "left", color: colors.text }}>{r.name}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", color: colors.textSecondary }}>{r.class}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", color: colors.text }}>{r.level}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", color: colors.text }}>{r.floor}F</td>
                  <td style={{ padding: "6px 4px", textAlign: "center", color: colors.textSecondary }}>{r.turn}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 700, color: colors.accent }}>{r.score.toLocaleString()}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", color: colors.textSecondary, fontSize: 10 }}>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={() => dispatch({ type: "RESET" })} style={S.btn()}>타이틀로 돌아가기</button>
      </div>
    </div>
  );
}

function BattleModal({ modal, state, dispatch }) {
  const enemy = modal.enemy;
  const player = state.player;
  const enemyHpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
  const playerHpPct = Math.max(0, (player.hp / player.maxHp) * 100);
  const playerMpPct = Math.max(0, (player.mp / player.maxMp) * 100);
  const isOver = !!modal.result;

  const barLabel = { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2, color: colors.textSecondary };

  return (
    <div style={S.modal}>
      <div style={{ ...S.modalBox, minWidth: 420 }}>
        <div style={{ ...S.modalTitle, background: colors.cellEnemy }}>전투: {enemy.name}</div>
        <div style={S.modalBody}>
          {/* Enemy HP */}
          <div style={barLabel}><span>👹 {enemy.name}</span><span style={{ color: colors.danger, fontWeight: 600 }}>{enemy.hp}/{enemy.maxHp}</span></div>
          <div style={S.hpBar(enemyHpPct, colors.danger)} />

          {/* Player HP */}
          <div style={{ ...barLabel, marginTop: 10 }}><span>🧑 HP</span><span style={{ color: playerHpPct > 30 ? colors.success : colors.danger, fontWeight: 600 }}>{player.hp}/{player.maxHp}</span></div>
          <div style={S.hpBar(playerHpPct, playerHpPct > 30 ? colors.success : colors.danger)} />

          {/* Player MP */}
          <div style={barLabel}><span>🔷 MP</span><span style={{ color: colors.accent, fontWeight: 600 }}>{player.mp}/{player.maxMp}</span></div>
          <div style={S.hpBar(playerMpPct, colors.accent)} />

          {!isOver && !modal.showItemSelect && (
            <div style={{ display: "flex", gap: 6, margin: "12px 0" }}>
              <button onClick={() => dispatch({ type: "BATTLE_ACTION", actionType: "attack" })} style={S.btnOutline}>공격 (1)</button>
              <button onClick={() => dispatch({ type: "BATTLE_ACTION", actionType: "skill" })} style={S.btnOutline}>스킬 (2)</button>
              <button onClick={() => dispatch({ type: "BATTLE_ACTION", actionType: "item" })} style={S.btnOutline}>아이템 (3)</button>
              <button onClick={() => dispatch({ type: "BATTLE_ACTION", actionType: "flee" })} style={S.btnOutline}>도주 (4)</button>
            </div>
          )}

          {!isOver && modal.showItemSelect && (
            <div style={{ margin: "12px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>소모품 선택</span>
                <button onClick={() => dispatch({ type: "BATTLE_ACTION", actionType: "cancelItem" })} style={{ ...S.btnOutline, padding: "2px 10px", fontSize: 11 }}>뒤로</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
                {player.inventory.map((item, i) => {
                  if (item.type !== "소모품") return null;
                  return (
                    <button key={i} onClick={() => dispatch({ type: "BATTLE_ACTION", actionType: "item", itemIndex: i })} style={{
                      ...S.btnOutline,
                      padding: "6px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textAlign: "left",
                    }}>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: colors.success }}>{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isOver && (
            <div style={{ textAlign: "center", margin: "12px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: modal.result === "victory" ? colors.success : colors.danger }}>
                {modal.result === "victory" ? "승리!" : "패배..."}
              </div>
              {modal.reward && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{modal.reward}</div>}
              <button onClick={() => dispatch({ type: "CLOSE_MODAL" })} style={{ ...S.btn(modal.result === "victory" ? colors.accent : colors.danger), marginTop: 12 }}>계속</button>
            </div>
          )}

          <div style={{ background: "#f8f9fa", borderRadius: 4, padding: 8, maxHeight: 120, overflowY: "auto", fontSize: 11, marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: colors.textSecondary, fontSize: 10, letterSpacing: 0.5 }}>전투 기록</div>
            {[...modal.log].reverse().map((l, i) => (
              <div key={i} style={{
                color: i === 0 ? colors.textPrimary : colors.textSecondary,
                fontWeight: i === 0 ? 600 : 400,
                opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.2),
                padding: "2px 0",
                borderLeft: i === 0 ? `3px solid ${colors.accent}` : "3px solid transparent",
                paddingLeft: 8,
                fontSize: i === 0 ? 12 : 11,
              }}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventModal({ modal, dispatch }) {
  return (
    <div style={S.modal}>
      <div style={S.modalBox}>
        <div style={{ ...S.modalTitle, background: "#fef7e0" }}>⚠ 이벤트</div>
        <div style={{ ...S.modalBody, fontSize: 13 }}>{modal.text}</div>
        <div style={S.modalFooter}>
          <button onClick={() => dispatch({ type: "CLOSE_MODAL" })} style={S.btn()}>확인</button>
        </div>
      </div>
    </div>
  );
}

function ShopModal({ modal, state, dispatch }) {
  const [bought, setBought] = useState({});
  const items = modal.items;

  const handleBuy = (item, idx) => {
    if (state.player.gold < item.price) return;
    if (state.player.inventory.length >= 20) return;
    dispatch({ type: "BUY_ITEM", item });
    setBought(prev => ({ ...prev, [idx]: true }));
  };

  const rarityColor = { "일반": colors.textSecondary, "고급": colors.success, "희귀": colors.accent, "에픽": "#7b1fa2" };

  return (
    <div style={S.modal}>
      <div style={{ ...S.modalBox, minWidth: 440 }}>
        <div style={{ ...S.modalTitle, background: colors.cellShop, display: "flex", justifyContent: "space-between" }}>
          <span>💰 상점</span>
          <span style={{ fontWeight: 400, fontSize: 13 }}>보유 골드: {state.player.gold}G</span>
        </div>
        <div style={{ ...S.modalBody, padding: 0 }}>
          <table style={{ ...S.table, marginBottom: 0 }}>
            <thead>
              <tr>
                {["아이템", "타입", "등급", "효과", "가격", ""].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const soldOut = bought[i];
                const cantAfford = state.player.gold < item.price;
                const invFull = state.player.inventory.length >= 20;
                return (
                  <tr key={i} style={{ opacity: soldOut ? 0.4 : 1 }}>
                    <td style={{ ...S.td, fontWeight: 500 }}>{item.name}</td>
                    <td style={{ ...S.td, fontSize: 11 }}>{item.type}</td>
                    <td style={{ ...S.td, color: rarityColor[item.rarity] || colors.textPrimary, fontSize: 11 }}>{item.rarity}</td>
                    <td style={{ ...S.td, fontSize: 11, color: colors.textSecondary }}>{item.desc}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{item.price}G</td>
                    <td style={S.td}>
                      {soldOut ? (
                        <span style={{ fontSize: 11, color: colors.textSecondary }}>구매완료</span>
                      ) : (
                        <button
                          style={{ ...S.btn(cantAfford || invFull ? "#ccc" : colors.accent), padding: "4px 12px", fontSize: 11 }}
                          onClick={() => handleBuy(item, i)}
                          disabled={cantAfford || invFull}
                        >
                          {invFull ? "가득참" : cantAfford ? "부족" : "구매"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={S.modalFooter}>
          <button onClick={() => dispatch({ type: "CLOSE_MODAL" })} style={S.btnOutline}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function LevelUpModal({ modal, dispatch }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={S.modal}>
      <div style={{ ...S.modalBox, minWidth: 380 }}>
        <div style={{ ...S.modalTitle, background: "#e8f0fe" }}>Level Up!</div>
        <div style={{ ...S.modalBody, padding: "16px" }}>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>강화할 스탯을 선택하세요:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {modal.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                style={{
                  padding: "12px 16px",
                  border: `2px solid ${selected === i ? colors.accent : colors.menuBorder}`,
                  borderRadius: 8,
                  background: selected === i ? "#e8f0fe" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{choice.label}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{choice.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={S.modalFooter}>
          <button
            onClick={() => selected !== null && dispatch({ type: "LEVEL_UP_CHOOSE", choice: modal.choices[selected] })}
            style={{ ...S.btn(selected !== null ? colors.accent : "#ccc"), padding: "10px 24px" }}
            disabled={selected === null}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryTab({ state, dispatch }) {
  const p = state.player;
  return (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>장착 중</div>
      <table style={S.table}>
        <thead><tr>{["슬롯", "이름", "효과", "동작"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {["무기", "방어구", "장신구"].map(slot => (
            <tr key={slot}>
              <td style={S.td}>{slot}</td>
              <td style={S.td}>{p.equipped[slot]?.name || "(없음)"}</td>
              <td style={{ ...S.td, fontSize: 11, color: colors.success }}>{p.equipped[slot]?.desc || "—"}</td>
              <td style={S.td}>{p.equipped[slot] && <button style={{ ...S.btnOutline, padding: "2px 8px", fontSize: 11 }} onClick={() => {
                const item = p.equipped[slot];
                const newP = { ...p, equipped: { ...p.equipped, [slot]: null }, inventory: [...p.inventory, item] };
                dispatch({ type: "SET_PLAYER", player: newP });
              }}>해제</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>인벤토리 ({p.inventory.length}/20)</div>
      <table style={S.table}>
        <thead><tr>{["#", "이름", "종류", "등급", "효과", "동작"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {p.inventory.map((item, i) => {
            const rarityColor = { "일반": colors.textSecondary, "고급": colors.success, "희귀": colors.accent, "에픽": "#7b1fa2" };
            return (
              <tr key={i}>
                <td style={S.td}>{i + 1}</td>
                <td style={S.td}>{item.name}</td>
                <td style={{ ...S.td, fontSize: 11 }}>{item.type}</td>
                <td style={{ ...S.td, fontSize: 11, color: rarityColor[item.rarity] || colors.textPrimary }}>{item.rarity}</td>
                <td style={{ ...S.td, fontSize: 11, color: colors.success }}>{item.desc}</td>
                <td style={S.td}>
                  <button style={{ ...S.btnOutline, padding: "2px 8px", fontSize: 11 }} onClick={() => dispatch({ type: "USE_ITEM", item })}>
                    {item.type === "소모품" ? "사용" : "장착"}
                  </button>
                </td>
              </tr>
            );
          })}
          {p.inventory.length === 0 && <tr><td colSpan={6} style={{ ...S.td, color: colors.textSecondary, textAlign: "center" }}>비어있음</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatsTab({ state }) {
  const p = state.player;
  const cls = CLASSES[p.class];
  const stats = [
    ["직업", p.class], ["레벨", p.level],
    ["HP", `${p.hp} / ${p.maxHp}`], ["MP", `${p.mp} / ${p.maxMp}`],
    ["ATK", p.atk + (p.equipped["무기"]?.effect.atk || 0)],
    ["DEF", Math.floor((p.def + (p.equipped["방어구"]?.effect.def || 0)) * p.buffs.defMultiplier)],
    ["CRT", `${p.crt + (p.equipped["장신구"]?.effect.crt || 0)}%`],
    ["경험치", `${p.exp} / ${p.expNext}`],
    ["골드", `${p.gold}G`],
    ["층", `${state.floor}F`],
    ["턴", state.turn],
  ];

  return (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>캐릭터 스탯</div>
      <table style={S.table}>
        <thead><tr><th style={S.th}>항목</th><th style={S.th}>수치</th></tr></thead>
        <tbody>{stats.map(([k, v]) => <tr key={k}><td style={S.td}>{k}</td><td style={S.td}>{v}</td></tr>)}</tbody>
      </table>

      <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>장비</div>
      <table style={S.table}>
        <thead><tr><th style={S.th}>슬롯</th><th style={S.th}>아이템</th></tr></thead>
        <tbody>
          {["무기", "방어구", "장신구"].map(s => (
            <tr key={s}><td style={S.td}>{s}</td><td style={S.td}>{state.player.equipped[s]?.name || "(없음)"}</td></tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>스킬</div>
      <table style={S.table}>
        <tbody>
          <tr><td style={S.td}>{cls.skill.name}</td><td style={S.td}>MP {cls.skill.cost}</td><td style={{ ...S.td, color: colors.textSecondary }}>{cls.skill.desc}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function PurchaseHistoryTab({ state }) {
  const rarityColor = { "일반": colors.textSecondary, "고급": colors.success, "희귀": colors.accent, "에픽": "#7b1fa2" };
  const history = state.purchaseHistory;

  if (history.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textSecondary, flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 24 }}>🧾</span>
        <span>아직 구매 이력이 없습니다.</span>
        <span style={{ fontSize: 11 }}>던전에서 $SHOP 셀을 찾아 아이템을 구매해보세요!</span>
      </div>
    );
  }

  const totalSpent = history.reduce((sum, r) => sum + r.price, 0);

  return (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>🧾 구매 이력</div>
        <div style={{ fontSize: 11, color: colors.textSecondary }}>총 {history.length}건 · {totalSpent}G 사용</div>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            {["#", "아이템", "종류", "등급", "효과", "가격", "층", "턴"].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((record, i) => (
            <tr key={i}>
              <td style={{ ...S.td, color: colors.textSecondary, fontSize: 10 }}>{history.length - i}</td>
              <td style={S.td}>{record.name}</td>
              <td style={S.td}>{record.type}</td>
              <td style={{ ...S.td, color: rarityColor[record.rarity] || colors.text, fontWeight: 500 }}>{record.rarity}</td>
              <td style={{ ...S.td, fontSize: 11 }}>{record.desc}</td>
              <td style={{ ...S.td, color: "#d4a017", fontWeight: 600 }}>{record.price}G</td>
              <td style={S.td}>{record.floor}F</td>
              <td style={{ ...S.td, color: colors.textSecondary }}>{record.turn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN GAME SCREEN
// ═══════════════════════════════════════════════════
function GameScreen({ state, dispatch }) {
  const { dungeon, player, activeTab, modal, battleLog } = state;

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e) => {
      if (modal && modal.type === "battle" && !modal.result) {
        if (modal.showItemSelect) {
          if (e.key === "Escape") dispatch({ type: "BATTLE_ACTION", actionType: "cancelItem" });
          return;
        }
        if (e.key === "1") dispatch({ type: "BATTLE_ACTION", actionType: "attack" });
        else if (e.key === "2") dispatch({ type: "BATTLE_ACTION", actionType: "skill" });
        else if (e.key === "3") dispatch({ type: "BATTLE_ACTION", actionType: "item" });
        else if (e.key === "4") dispatch({ type: "BATTLE_ACTION", actionType: "flee" });
        return;
      }
      if (modal) {
        if (e.key === "Enter" || e.key === " ") dispatch({ type: "CLOSE_MODAL" });
        return;
      }
      const moves = { ArrowUp: { dr: -1, dc: 0 }, ArrowDown: { dr: 1, dc: 0 }, ArrowLeft: { dr: 0, dc: -1 }, ArrowRight: { dr: 0, dc: 1 } };
      if (moves[e.key]) {
        e.preventDefault();
        dispatch({ type: "MOVE", ...moves[e.key] });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modal, dispatch]);

  const cols = "ABCDEFGH".split("");
  const hpPct = (player.hp / player.maxHp) * 100;
  const mpPct = (player.mp / player.maxMp) * 100;

  return (
    <div style={S.app}>
      {/* Menu Bar */}
      <div style={S.menuBar}>
        <div style={{ width: 20, height: 20, background: colors.accent, borderRadius: 4, marginRight: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>S</div>
        <span style={{ fontWeight: 600, marginRight: 12, fontSize: 13 }}>셀 던전</span>
        {["파일", "편집", "보기", "삽입", "서식", "데이터", "도움말"].map(m => (
          <span key={m} style={S.menuItem}>{m}</span>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        {["↶", "↷", "|", "B", "I", "U", "|", "A", "🎨", "|", "≡", "≡", "≡", "|", "□", "⊞"].map((t, i) => (
          <span key={i} style={t === "|" ? { color: colors.menuBorder, margin: "0 2px" } : S.toolBtn}>{t === "|" ? "|" : t}</span>
        ))}
      </div>

      {/* Formula Bar */}
      <div style={S.formulaBar}>
        <span style={S.fxLabel}>fx</span>
        <span style={S.fxText}>{battleLog}</span>
      </div>

      {/* Main Content */}
      {activeTab === "Sheet1" ? (
        <div style={S.gridContainer}>
          <div style={S.gridWrapper}>
            {/* Column headers */}
            <div style={S.headerRow}>
              <div style={{ ...S.rowHeader, width: 32, height: 24 }}></div>
              {cols.map(c => <div key={c} style={S.headerCell}>{c}</div>)}
            </div>
            {/* Grid rows */}
            {Array.from({ length: GRID }, (_, r) => (
              <div key={r} style={S.gridRow}>
                <div style={S.rowHeader}>{r + 1}</div>
                {Array.from({ length: GRID }, (_, c) => {
                  const isPlayer = dungeon.playerPos[0] === r && dungeon.playerPos[1] === c;
                  const revealed = dungeon.revealed[r][c];
                  const disp = getCellDisplay(dungeon.map[r][c], isPlayer, revealed);
                  return (
                    <div key={c} style={{
                      ...S.cell,
                      background: disp.bg,
                      color: disp.color || colors.textPrimary,
                      fontWeight: disp.fontWeight || 400,
                      fontSize: disp.fontSize || 12,
                      border: isPlayer ? `2px solid ${colors.accent}` : `1px solid ${colors.cellBorder}`,
                    }}>
                      {disp.text}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* D-pad */}
          <div style={S.dpad}>
            <div />
            <button style={S.dpadBtn} onClick={() => dispatch({ type: "MOVE", dr: -1, dc: 0 })}>▲</button>
            <div />
            <button style={S.dpadBtn} onClick={() => dispatch({ type: "MOVE", dr: 0, dc: -1 })}>◀</button>
            <button style={S.dpadBtn} onClick={() => dispatch({ type: "MOVE", dr: 0, dc: 1 })}>▶</button>
            <button style={S.dpadBtn} onClick={() => dispatch({ type: "MOVE", dr: 1, dc: 0 })}>▼</button>
          </div>
        </div>
      ) : activeTab === "인벤토리" ? (
        <InventoryTab state={state} dispatch={dispatch} />
      ) : activeTab === "스탯" ? (
        <StatsTab state={state} />
      ) : (
        <PurchaseHistoryTab state={state} />
      )}

      {/* Sheet Tabs */}
      <div style={S.tabs}>
        {["Sheet1", "인벤토리", "스탯", "구매이력"].map(tab => (
          <button key={tab} onClick={() => dispatch({ type: "SET_TAB", tab })} style={S.tab(activeTab === tab)}>{tab}</button>
        ))}
      </div>

      {/* Status Bar */}
      <div style={S.statusBar}>
        <span>HP: {player.hp}/{player.maxHp}</span>
        <span style={{ display: "inline-block", width: 60, height: 6, background: `linear-gradient(to right, ${hpPct > 30 ? colors.success : colors.danger} ${hpPct}%, #e0e0e0 ${hpPct}%)`, borderRadius: 3 }} />
        <span>MP: {player.mp}/{player.maxMp}</span>
        <span style={{ display: "inline-block", width: 60, height: 6, background: `linear-gradient(to right, ${colors.accent} ${mpPct}%, #e0e0e0 ${mpPct}%)`, borderRadius: 3 }} />
        <span>{state.floor}층</span>
        <span>{state.turn}턴</span>
        <span>골드: {player.gold}G</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>셀 던전 v0.1</span>
      </div>

      {/* Modals */}
      {modal?.type === "battle" && <BattleModal modal={modal} state={state} dispatch={dispatch} />}
      {modal?.type === "event" && <EventModal modal={modal} dispatch={dispatch} />}
      {modal?.type === "shop" && <ShopModal modal={modal} state={state} dispatch={dispatch} />}
      {modal?.type === "levelUp" && <LevelUpModal modal={modal} dispatch={dispatch} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, null, initState);

  // Extended dispatch to handle non-reducer actions
  const gameDispatch = useCallback((action) => {
    if (action.type === "SET_SCREEN") {
      dispatch({ type: "RESET" });
      // Hacky: set screen via a special init
      if (action.screen === "classSelect") {
        // We'll use a local state for this
      }
    }
    dispatch(action);
  }, []);

  // Simple screen routing using state.screen
  // For classSelect we need a workaround since RESET goes to title
  const [showClassSelect, setShowClassSelect] = useState(false);

  const wrappedDispatch = useCallback((action) => {
    if (action.type === "SET_SCREEN" && action.screen === "classSelect") {
      setShowClassSelect(true);
      return;
    }
    if (action.type === "RESET") {
      setShowClassSelect(false);
    }
    if (action.type === "START_GAME") {
      setShowClassSelect(false);
    }
    dispatch(action);
  }, []);

  if (state.screen === "gameOver") return <GameOverScreen state={state} dispatch={wrappedDispatch} />;
  if (state.screen === "ranking") return <RankingScreen dispatch={wrappedDispatch} />;
  if (showClassSelect) return <ClassSelect dispatch={wrappedDispatch} />;
  if (state.screen === "game") return <GameScreen state={state} dispatch={wrappedDispatch} />;
  return <TitleScreen dispatch={wrappedDispatch} />;
}
