import {each, find, isEqual, map, sortBy} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {GameServer} from 'server/server/GameServer';
import {clearDebugCache, shuffle} from 'server/helpers/util';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {getCardActions} from 'server/formatters/formatCardActions';
import {ICardEvent} from 'shared/interfaces/cards';
import {ICardEventMenuItem} from 'shared/interfaces/cardMenu';
import {createBrutforceServer} from '_integration/createBrutforceServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EEventID} from 'shared/enum/cards';

function getRandomItemFromArray<T>(arr: readonly T[] | undefined): T | undefined {
	if (!arr || arr.length === 0) return undefined;
	return shuffle([...arr])[0];
}

// Pick the player's most-constrained playable card (fewest menu options first,
// preferring an actually-playable one). Returns undefined only if the hand is empty.
const getPreferredPlayableCard = (game: Game, player: Player, preferInfect: boolean): ICardEvent | undefined => {
	const playableCards = map(player.hand, card => ({
		uniqueId: card.uniqueId,
		menu: getCardActions(game, player, card),
		id: card.id,
	}));
	if (playableCards.length === 0) return undefined;
	const sorted = sortBy(playableCards, ({menu}) => menu.length);
	const top = sorted[sorted.length - 1];
	if (!top) throw new Error(`Игроку нечем ходить ${player.nickname}`);

	if (preferInfect && player.isThing) {
		const infectCard = find(player.hand, {id: EEventID.infect});
		if (infectCard) return infectCard;
	}
	return find(player.hand, {uniqueId: top.uniqueId});
};

// Loop-detector: if the same (player, actions) repeats too often the game is
// stuck — surface it as an error so the fuzz test fails loudly.
let lastAction: unknown = null;
let actionCounter = 0;
const checkLastAction = (player: Player, actions: ICardEventMenuItem[]) => {
	const signature = [player.id, actions];
	if (isEqual(lastAction, signature)) {
		if (actionCounter > 10) {
			throw new Error('TEST CYCLE LOOP');
		}
		actionCounter++;
		return;
	}
	actionCounter = 0;
	lastAction = signature;
};

const botSelectCardLogic = (gameServer: GameServer, player: Player) => {
	const action = player.currentAction;
	if (!action || action.type !== ENotificationAction.selectCard) return;
	const randomCard = getRandomItemFromArray(Object.values(action.cards));
	if (!randomCard || !randomCard.uniqueId) return;
	gameServer.playerAction({player, actionType: EPlayerActionType.cardSelect, cardUniqueId: randomCard.uniqueId});
};

// Пачку карт бот отмечает и подтверждает разом — ровно как живой игрок в окне
// выбора (ENotificationAction.selectCards).
const botSelectCardsLogic = (gameServer: GameServer, player: Player) => {
	const action = player.currentAction;
	if (!action || action.type !== ENotificationAction.selectCards) return;
	const cardUniqueIds = shuffle(Object.values(action.cards))
		.map(card => card.uniqueId)
		.filter((uniqueId): uniqueId is string => !!uniqueId)
		.slice(0, action.count);
	if (cardUniqueIds.length !== action.count) return;
	gameServer.playerAction({player, actionType: EPlayerActionType.cardsSelect, cardUniqueIds});
};

const botTradeCardLogic =(gameServer: GameServer, player: Player, game: Game) => {
	const preferredCard = getPreferredPlayableCard(game, player, true);
	if (!preferredCard || !preferredCard.uniqueId) return;
	const cardActions = getCardActions(game, player, preferredCard);
	const currentAction = getRandomItemFromArray(cardActions);
	if (!currentAction) return;
	checkLastAction(player, cardActions);
	gameServer.playerAction({player, actionType: currentAction.menuType, cardUniqueId: preferredCard.uniqueId});
};

const botActionDecisionLogic = (gameServer: GameServer, player: Player) => {
	const action = player.currentAction;
	if (!action || action.type !== ENotificationAction.actionDecision) return;
	const randomAction = getRandomItemFromArray(action.menu);
	if (!randomAction) return;
	gameServer.playerAction({actionType: EPlayerActionType.actionDecision, player, action: randomAction.action});
};

const botPlayerSelectLogic = (gameServer: GameServer, player: Player) => {
	const action = player.currentAction;
	if (!action || action.type !== ENotificationAction.playerSelect) return;
	const selectedPlayerId = getRandomItemFromArray(action.playersToSelect);
	if (!selectedPlayerId) return;
	gameServer.playerAction({player, actionType: EPlayerActionType.playerSelect, selectedPlayerId});
};

const botPlayerTurnCardLogic = (gameServer: GameServer, player: Player, game: Game) => {
	const preferredCard = getPreferredPlayableCard(game, player, false);
	if (!preferredCard || !preferredCard.uniqueId) return;
	const cardActions = getCardActions(game, player, preferredCard);
	const currentAction = getRandomItemFromArray(cardActions);
	if (!currentAction) return;
	gameServer.playerAction({player, actionType: currentAction.menuType, cardUniqueId: preferredCard.uniqueId});
};

const botAct = (gameServer: GameServer, player: Player, game: Game): boolean => {
	if (player.turnState === ETurnState.inCardActionProgress) {
		if (Math.random() > 0.5) {
			gameServer.playerAction({player, actionType: EPlayerActionType.actionCancel});
			return true;
		}
	}

	if (!player.currentAction) return false;
	if (player.state === EPlayerState.door) return false;
	switch (player.currentAction.type) {
		case ENotificationAction.selectCard:
			botSelectCardLogic(gameServer, player);
			return true;
		case ENotificationAction.selectCards:
			botSelectCardsLogic(gameServer, player);
			return true;
		case ENotificationAction.offenseTradeCard:
		case ENotificationAction.defenseTradeCard:
			botTradeCardLogic(gameServer, player, game);
			return true;
		case ENotificationAction.actionDecision:
			botActionDecisionLogic(gameServer, player);
			return true;
		case ENotificationAction.playerSelect:
			botPlayerSelectLogic(gameServer, player);
			return true;
		case ENotificationAction.turnCard:
			botPlayerTurnCardLogic(gameServer, player, game);
			return true;
		case ENotificationAction.cardPick:
			gameServer.playerAction({player, actionType: EPlayerActionType.cardPick});
			return true;
		case ENotificationAction.okayCard:
			// Бот «закрывает» окно с подсмотренными картами: пока оно открыто, ход
			// стоит на осмотре (см. cardsView).
			gameServer.playerAction({player, actionType: EPlayerActionType.viewConfirm});
			return true;
		default:
			return false;
	}
};

const isGameOver = (game: Game): boolean => {
	const lastLog = game.gameLog[game.gameLog.length - 1];
	return lastLog?.text === 'Нечто победило' || lastLog?.text === 'Нечто проиграло';
};

export interface IBrutforceResult {
	iterations: number;
	thingWins: number;
}

// Play `iterations` full random games to completion. Throws if the engine
// throws, a game gets stuck, or a game fails to reach a valid end state —
// i.e. this is the crash/undefined-behavior fuzz test for the server.
export const runBrutforce = (iterations: number, {silent = true}: {silent?: boolean} = {}): IBrutforceResult => {
	let thingWins = 0;
	lastAction = null;
	actionCounter = 0;

	for (let iteration = 0; iteration < iterations; iteration++) {
		const [gameServer, game] = createBrutforceServer();
		let safety = 0;
		while (!isGameOver(game)) {
			if (++safety > 10000) {
				throw new Error(`Игра не завершилась за разумное число шагов (итерация ${iteration})`);
			}
			let actioniterated = false;
			each([...game.playersList], pId => {
				const player = game.players[pId];
				if (!player) return;
				const iterated = botAct(gameServer, player, game);
				if (!actioniterated) actioniterated = iterated;
			});
			if (!actioniterated && !isGameOver(game)) {
				throw new Error(`Игра застряла без возможного хода (итерация ${iteration})`);
			}
		}
		if (game.gameLog[game.gameLog.length - 1]?.text === 'Нечто победило') thingWins++;
		clearDebugCache();
		if (!silent && (iteration + 1) % 100 === 0) {
			console.log(`Итераций: ${iteration + 1}, побед Нечто: ${thingWins}`);
		}
	}

	return {iterations, thingWins};
};
