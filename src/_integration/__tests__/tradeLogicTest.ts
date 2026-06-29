import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {expectOkayCard} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardAny} from 'shared/interfaces/cards';
import {ITurnContext} from 'shared/interfaces/turnContext';

function assertDefined<T>(value: T, message: string): asserts value is NonNullable<T> {
	if (value === null || value === undefined) throw new Error(message);
}

const requireDefined = <T>(value: T | null | undefined, message: string): T => {
	assertDefined(value, message);
	return value;
};

const cardUid = (card: ICardAny | undefined): string =>
	requireDefined(requireDefined(card, 'Карта не найдена').uniqueId, 'У карты нет uniqueId');

const requireTurnContext = (turnContext: ITurnContext | null): ITurnContext =>
	requireDefined(turnContext, 'turnContext не задан');

describe('trade logic',  () => {

	it('should trade the card', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		assertDefined(offensePlayer, 'offensePlayer не найден');
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.tenacity), getCard(EEventID.analysis));
		const discardCard = offensePlayer.hand[0];
		const tradeCard = offensePlayer.hand[1];

		game.changeTurn(offensePlayer.id);



		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(discardCard),
			actionType: EPlayerActionType.cardDiscard
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade)

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(tradeCard),
			actionType: EPlayerActionType.cardTrade
		});

		const nextPlayer = offensePlayer.getNextPlayer();
		const randomNextPlayerCard = nextPlayer.getRandomPlayableCard();
		expect(nextPlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:nextPlayer,
			cardUniqueId: cardUid(randomNextPlayerCard),
			actionType: EPlayerActionType.cardTrade
		});

		expect(nextPlayer.hand).toContainEqual(expect.objectContaining({id: requireDefined(tradeCard, 'tradeCard не найдена').id}));
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({id: requireDefined(randomNextPlayerCard, 'randomNextPlayerCard не найдена').id}));

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextPlayer.hand.length).toBe(5);


		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('should infect by trading infect', () => {
		const [gameServer, game, offensePlayer] = createMockGameServer();
		assertDefined(offensePlayer, 'offensePlayer не найден');
		const nextPlayer = offensePlayer.getNextPlayer();
		offensePlayer.isThing = true;
		offensePlayer.hand.splice(0,1);
		nextPlayer.isInfected = false;
		offensePlayer.hand.splice(0,2, getCard(EEventID.analysis), getCard(EEventID.infect));
		const discardCard = offensePlayer.hand[0];
		const tradeCard = offensePlayer.hand[1];

		game.changeTurn(offensePlayer.id);



		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(discardCard),
			actionType: EPlayerActionType.cardDiscard
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade);


		expect(nextPlayer.isInfected).toBe(false);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(tradeCard),
			actionType: EPlayerActionType.cardTrade
		});

		const randomNextPlayerCard = nextPlayer.getRandomPlayableCard();
		expect(nextPlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:nextPlayer,
			cardUniqueId: cardUid(randomNextPlayerCard),
			actionType: EPlayerActionType.cardTrade
		});
		expect(nextPlayer.isInfected).toBe(true);
		expect(nextPlayer.hand).toContainEqual(expect.objectContaining({id: requireDefined(tradeCard, 'tradeCard не найдена').id}));
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({id: requireDefined(randomNextPlayerCard, 'randomNextPlayerCard не найдена').id}));

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextPlayer.hand.length).toBe(5);


		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('should game end if all infectd', () => {
		const [gameServer, game, offensePlayer, nextPlayer, APlayer, BPlayer, CPlayer, DPlayer] = createMockGameServer();
		assertDefined(offensePlayer, 'offensePlayer не найден');
		assertDefined(nextPlayer, 'nextPlayer не найден');
		assertDefined(APlayer, 'APlayer не найден');
		assertDefined(BPlayer, 'BPlayer не найден');
		assertDefined(CPlayer, 'CPlayer не найден');
		assertDefined(DPlayer, 'DPlayer не найден');
		APlayer.isInfected = true;
		BPlayer.isInfected = true;
		CPlayer.isInfected = true;
		DPlayer.isInfected = true;
		nextPlayer.isInfected = false;

		offensePlayer.isThing = true;
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.analysis), getCard(EEventID.infect));
		const discardCard = offensePlayer.hand[0];
		const tradeCard = offensePlayer.hand[1];

		game.changeTurn(offensePlayer.id);



		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(discardCard),
			actionType: EPlayerActionType.cardDiscard
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(requireTurnContext(game.turnContext).type).toBe(ETurnContextType.trade)


		expect(nextPlayer.isInfected).toBe(false);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: cardUid(tradeCard),
			actionType: EPlayerActionType.cardTrade
		});

		const randomNextPlayerCard = nextPlayer.getRandomPlayableCard();
		expect(nextPlayer.turnState).toBe(ETurnState.inDefenseTrade);
		testPlayerAction(gameServer, game, {
			player:nextPlayer,
			cardUniqueId: cardUid(randomNextPlayerCard),
			actionType: EPlayerActionType.cardTrade
		});

		expect(nextPlayer.isInfected).toBe(true);
		expect(nextPlayer.hand).toContainEqual(expect.objectContaining({id: requireDefined(tradeCard, 'tradeCard не найдена').id}));
		expect(offensePlayer.hand).toContainEqual(expect.objectContaining({id: requireDefined(randomNextPlayerCard, 'randomNextPlayerCard не найдена').id}));

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);


		expectOkayCard(nextPlayer, null, 'Нечто выйграло')

	});

});

