# Authoring per-card browser e2e specs

These Playwright specs reproduce each card **literally in the browser**: a real
host + 4 joiners assemble a real game over the real socket.io server and Bun
game engine; we deterministically arrange a known scenario, then drive the
faithful PixiJS client through `window.__nechto` (the live `GameController` —
the same methods the canvas pointer handlers call) and assert on its observable
state (what is actually rendered).

The corresponding engine unit test in
`src/_integration/__tests__/cardLogic/**` and the server card action in
`src/server/helpers/cardActions/**` are the **behavioral oracle** — mirror the
unit test's scenario and sequence, translating engine asserts to browser
observables.

## Skeleton

```ts
import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('<Russian card name> (<cardId>)', () => {
  let session: GameSession;
  test.beforeAll(async ({browser}: {browser: Browser}) => { session = await startGame(browser, NICKS); });
  test.afterAll(async () => { await session.close(); });

  test('<scenario>', async () => {
    await session.arrange({ players: NICKS, turn: 'Alice', hands: { Alice: fill(['<cardId>']), Bob: fill([], 4) } });
    await session.play('Alice', '<cardId>');
    // ... drive + assert
  });
});
```

## `GameSession` API

- `arrange(payload)` — deterministically set up the running game and wait until
  applied. Payload: `{ players: string[] (seating order, nicks), turn: nick,
  turnState?: 'inCardAction'|'inCardPick' (default inCardAction), hands:
  {nick: cardId[]}, deck?: cardId[] (top first), discarded?: cardId[], things?:
  nick[], infected?: nick[], quarantine?: {nick:number}, quarantineFresh?:
  nick[], clockwise?: boolean }`. Always pass `players: NICKS`. Give the turn
  player 5 cards (`fill([...])`) for `inCardAction`, 4 for `inCardPick`; give
  other relevant players 4 (`fill([...], 4)`).
- `snapshot(nick)` → `{ currentPlayerId, hand:{uid:{id,uniqueId}}, handActions,
  players:{id:{id,nickname,turnState,state,quarantine,isInfected,isThing}},
  playersList, currentAction, notifications, gameLog, deck:{count,topCardType},
  isPlayerCanCancel }`. NOTE: `hand` and `isInfected/isThing` are only truthful
  for that player's OWN view — to check Bob's hand, snapshot('Bob').
- `idOf(nick)` → server player id.
- `play(nick, cardId)` — cardAct the card (must be in hand).
- `discard(nick, cardId)` / `offerTrade(nick, cardId)` — discard / trade a card.
- `selectPlayer(nick, targetNick)` — choose a target player (player-select step).
- `selectId(nick, targetId)` — choose a target by raw id (e.g. a door player).
- `selectNotificationCard(nick, cardId)` — pick a card from a `selectCard`
  notification (tenacity / blindDate / forgetfulness).
- `decide(nick, action)` — choose a decision menu action (e.g. 'burn','noFire').
- `cardPick(nick)` — draw the top deck card (REQUIRED to trigger PANIC cards).
- `cancel(nick)` — cancel an in-progress action (inCardActionProgress).
- `waitFor(nick, snap => boolean)` — poll until predicate true (use after every
  action that changes state before asserting).
- `expectTurnState(nick, state)` — wait until that player's own turnState equals.

## Engine → browser assertion mapping

| engine (unit test)                  | browser (this spec)                                            |
|-------------------------------------|----------------------------------------------------------------|
| `player.turnState`                  | `snap.players[id].turnState` (snapshot that player)            |
| `player.hand` contents              | `Object.values(snapshot(nick).hand).map(c=>c.id)`             |
| `player.quarantine`                 | `snap.players[id].quarantine`                                  |
| door inserted (barricade)           | `snap.playersList` grows; a new id with `players[id].state==='door'` |
| `game.turnContext.type==='trade'`   | the offense player reaches `inOffenseTrade`; defense reaches `inDefenseTrade` |
| notification `okayCard`/reveal      | `snap.currentAction` (selectCard/playerSelect/actionDecision) or `snap.notifications[]` (okayCard/info/gameEnd) |
| game ends                           | `snap.notifications.some(n=>n.type==='gameEnd')`; text contains 'не справился' (Thing lost) / 'справился' |

`turnState` values: `idle`, `inCardPick`, `inCardAction`, `inCardActionProgress`,
`inOffenseTrade`, `inDefenseTrade`, `dead`. `currentAction.type` values:
`cardPick`, `turnCard`, `offenseTradeCard`, `defenseTradeCard`, `playerSelect`,
`selectCard`, `actionDecision`. After playing a targeted offense card the player
is `inCardActionProgress` and gets a `playerSelect` currentAction.

## REAL-GAME (non-mock) differences vs the unit tests

- The unit tests run in mock mode where `changeTurn` auto-draws. The REAL game
  does NOT: after a turn ends, the next player is in `inCardPick` with their
  pre-draw hand and must `cardPick(nick)` to draw. Assert `inCardPick` (NOT
  `inCardAction`) for the next player after a completed trade/turn.
- PANIC cards are never in a hand. Arrange `turnState: 'inCardPick'` with
  `deck: ['<panicId>', ...]`, then `await session.cardPick('Alice')` to draw and
  trigger the panic. `makePanic` first sends an okayCard "<nick> достает карту
  паники", then runs the effect.

## Rules

- `e2e/` is under the strict tsconfig: NO `any`, no unused vars. Type everything.
- Always `players: NICKS` and `describe.serial`. One `startGame` per file in
  `beforeAll`; each `test` calls `arrange` to reset to a clean scenario.
- Put any game-ENDING scenario (flamethrower burn of the Thing, over-infection)
  as the LAST test in the file.
- Cover the card EXHAUSTIVELY: the main effect, every branch/decision, target
  validity (quarantine/door/neighbour restrictions), and the "no valid target"
  / cancel path where the engine has one (read the server action for branches).
- Do NOT run Playwright (single shared server port). Just write the spec file.
