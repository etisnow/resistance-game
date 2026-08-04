import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardAny} from 'shared/interfaces/cards';
import {ITurnContext} from 'shared/interfaces/turnContext';
import {decisionTimeout} from 'server/helpers/askDecision';

function assertDefined<T>(value: T, message: string): asserts value is NonNullable<T> {
	if (value === null || value === undefined) throw new Error(message);
}

const cardUid = (card: ICardAny | undefined): string => {
	assertDefined(card, 'Карта не найдена');
	assertDefined(card.uniqueId, 'У карты нет uniqueId');
	return card.uniqueId;
};

const requireTurnContext = (turnContext: ITurnContext | null): ITurnContext => {
	assertDefined(turnContext, 'turnContext не задан');
	return turnContext;
};

describe('leavemealone test',  () => {

	it('should cancel position swap', () => {

		const [gameServer, game, defensePlayer] = createMockGameServer();
		assertDefined(defensePlayer, 'defensePlayer не найден');
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0]?.id).toBe(EEventID.leaveMeAlone);

		const offensePlayer = defensePlayer.getPrevPlayer();
		offensePlayer.hand.splice(0,1, getCard(EEventID.positionswap));



		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let positionswap = find(offensePlayer.hand, {id: EEventID.positionswap});

		expect(positionswap).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(positionswap),
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: cardUid(positionswap)}));

		let leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);


		//у defenseplayer'а есть возможность отказаться
		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'swap'}),
					expect.objectContaining({action:'cancelSwap'}),
				])
			})
		);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'cancelSwap',
		});

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		expect(initialDefensePosition).toBe(afterDefensePosition);
		expect(initialOffensePosition).toBe(afterOffensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: cardUid(leaveMeAlone) }));
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: cardUid(positionswap)}));
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);


	});

	it('should cancel reelFishingRold swap', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		assertDefined(defensePlayer, 'defensePlayer не найден');
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0]?.id).toBe(EEventID.leaveMeAlone);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,1, getCard(EEventID.reelFishingRods));



		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let reelFishingRods = find(offensePlayer.hand, {id: EEventID.reelFishingRods});

		expect(reelFishingRods).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(reelFishingRods),
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: cardUid(reelFishingRods)}));

		let leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);


		//у defenseplayer'а есть возможность отказаться

		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'swap'}),
					expect.objectContaining({action:'cancelSwap'}),
				])
			})
		);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'cancelSwap',
		});

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		expect(initialDefensePosition).toBe(afterDefensePosition);
		expect(initialOffensePosition).toBe(afterOffensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: cardUid(leaveMeAlone) }));
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: cardUid(reelFishingRods)}));
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);


	});

	it('should swap', () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		assertDefined(defensePlayer, 'defensePlayer не найден');
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.leaveMeAlone));
		expect(defensePlayer.hand[0]?.id).toBe(EEventID.leaveMeAlone);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,1, getCard(EEventID.positionswap));



		game.changeTurn(offensePlayer.id);

		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let positionswap = find(offensePlayer.hand, {id: EEventID.positionswap});

		expect(positionswap).not.toBe(undefined);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(positionswap),
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: cardUid(positionswap)}));

		let leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);


		//у defenseplayer'а есть возможность отказаться
		expect(defensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.actionDecision,
				menu: expect.arrayContaining([
					expect.objectContaining({action:'swap'}),
					expect.objectContaining({action:'cancelSwap'}),
				])
			})
		);
		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		testPlayerAction(gameServer, game, {
			actionType: EPlayerActionType.actionDecision,
			player:defensePlayer,
			action: 'swap',
		});

		const afterDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const afterOffensePosition = game.playersList.indexOf(offensePlayer.id);

		//Должны поменяться местами
		expect(initialDefensePosition).toBe(afterOffensePosition);
		expect(initialOffensePosition).toBe(afterDefensePosition);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade)
		expect(defensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.hand).toContainEqual(expect.objectContaining({ uniqueId: cardUid(leaveMeAlone) }));
		expect(offensePlayer.hand.length).toBe(4);
		expect(defensePlayer.hand.length).toBe(4);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('без «мне и здесь неплохо» всё равно спрашивают, а по таймауту меняют местами', async () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		assertDefined(defensePlayer, 'defensePlayer не найден');
		// Без защитной карты в меню остаётся единственный пункт — «Поменяться».
		defensePlayer.hand = defensePlayer.hand.filter((card) => card.id !== EEventID.leaveMeAlone);

		const offensePlayer = defensePlayer.getPrevPlayer();
		offensePlayer.hand.splice(0, 1, getCard(EEventID.positionswap));

		game.changeTurn(offensePlayer.id);
		const positionswap = find(offensePlayer.hand, {id: EEventID.positionswap});

		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		const initialTimeout = decisionTimeout.seconds;
		decisionTimeout.seconds = 0.02;
		try {
			testPlayerAction(gameServer, game, {
				player: offensePlayer,
				cardUniqueId: cardUid(positionswap),
				actionType: EPlayerActionType.cardAct
			});
			testPlayerAction(gameServer, game, {
				player: offensePlayer,
				selectedPlayerId: defensePlayer.id,
				actionType: EPlayerActionType.playerSelect
			});

			// Спрашиваем даже с одной кнопкой: молчаливый обмен выдавал бы, что
			// защитной карты на руке нет.
			expect(defensePlayer.currentAction).toEqual(
				expect.objectContaining({
					type: ENotificationAction.actionDecision,
					menu: [expect.objectContaining({action: 'swap'})],
				})
			);
			expect(game.playersList.indexOf(defensePlayer.id)).toBe(initialDefensePosition);

			await new Promise((resolve) => setTimeout(resolve, 60));
		} finally {
			decisionTimeout.seconds = initialTimeout;
		}

		expect(defensePlayer.currentAction).toBe(null);
		expect(game.playersList.indexOf(offensePlayer.id)).toBe(initialDefensePosition);
		expect(game.playersList.indexOf(defensePlayer.id)).toBe(initialOffensePosition);
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade);
	});

	it('по таймауту играется отказ от обмена, если защитная карта есть', async () => {
		const [gameServer, game, defensePlayer] = createMockGameServer();
		assertDefined(defensePlayer, 'defensePlayer не найден');
		defensePlayer.hand.splice(0, 1, getCard(EEventID.leaveMeAlone));
		const leaveMeAlone = find(defensePlayer.hand, {id: EEventID.leaveMeAlone});

		const offensePlayer = defensePlayer.getPrevPlayer();
		offensePlayer.hand.splice(0, 1, getCard(EEventID.positionswap));

		game.changeTurn(offensePlayer.id);
		const positionswap = find(offensePlayer.hand, {id: EEventID.positionswap});

		const initialDefensePosition = game.playersList.indexOf(defensePlayer.id);
		const initialOffensePosition = game.playersList.indexOf(offensePlayer.id);

		const initialTimeout = decisionTimeout.seconds;
		decisionTimeout.seconds = 0.02;
		try {
			testPlayerAction(gameServer, game, {
				player: offensePlayer,
				cardUniqueId: cardUid(positionswap),
				actionType: EPlayerActionType.cardAct
			});
			testPlayerAction(gameServer, game, {
				player: offensePlayer,
				selectedPlayerId: defensePlayer.id,
				actionType: EPlayerActionType.playerSelect
			});
			await new Promise((resolve) => setTimeout(resolve, 60));
		} finally {
			decisionTimeout.seconds = initialTimeout;
		}

		// По умолчанию — последний пункт меню, то есть защита: места остаются свои,
		// а «Мне и здесь неплохо» уходит в сброс.
		expect(game.playersList.indexOf(defensePlayer.id)).toBe(initialDefensePosition);
		expect(game.playersList.indexOf(offensePlayer.id)).toBe(initialOffensePosition);
		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: cardUid(leaveMeAlone)}));
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
	});

});
