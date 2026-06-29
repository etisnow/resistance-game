import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {requirePlayer} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {getMissNextPlayer} from 'server/helpers/cardActions/defense/miss';


describe('miss test',  () => {

	it('miss card', () => {
		const [gameServer, game, defensePlayerMaybe] = createMockGameServer();
		const defensePlayer = requirePlayer(game, defensePlayerMaybe?.id);
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.miss));
		expect(defensePlayer.hand[0]?.id).toBe(EEventID.miss);

		const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id})
		offensePlayer.hand.splice(0,2, getCard(EEventID.analysis), getCard(EEventID.barricade));

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let barricade = find(offensePlayer.hand, {id: EEventID.barricade});

		expect(barricade).not.toBe(undefined);
		if (!barricade) throw new Error('barricade card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: barricade.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardDiscard
		});


		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		let analysis = find(offensePlayer.hand, {id: EEventID.analysis});
		if (!analysis) throw new Error('analysis card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: analysis.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardTrade
		});
		analysis = find(offensePlayer.hand, {uniqueId: analysis.uniqueId});
		expect(analysis).toBe(undefined);
		let missCard = find(defensePlayer.hand, {id: EEventID.miss});
		expect(offensePlayer.turnState).toBe(ETurnState.idle);

		expect(defensePlayer.turnState).toBe(ETurnState.inDefenseTrade);
		if (!missCard) throw new Error('miss card not found');
		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			cardUniqueId: missCard.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});


		expect(defensePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: missCard.uniqueId }));
		//expect(offensePlayer.hand).toContainEqual(expect.objectContaining({uniqueId: analysis.uniqueId}));

		const nextDefensePlayer = getMissNextPlayer(game, defensePlayer);
		if (!nextDefensePlayer) throw new Error('next defense player not found');

		expect(defensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(nextDefensePlayer.turnState).toBe(ETurnState.inDefenseTrade);

		//Игрок дал одну карту на обмен и теперь у него 3 карты
		expect(offensePlayer.hand.length).toBe(3);
		//т.к теперь ходит нирон, у него 5 карт  на руке
		expect(defensePlayer.hand.length).toBe(4);
		expect(nextDefensePlayer.hand.length).toBe(4);

		/* начинаем трейд следующего игрока */
		const firstCard = nextDefensePlayer.hand[0];
		expect(firstCard).not.toBe(undefined);
		if (!firstCard) throw new Error('first card not found');

		testPlayerAction(gameServer, game, {
			player:nextDefensePlayer,
			cardUniqueId: firstCard.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardTrade
		});
		expect(offensePlayer.hand.length).toBe(4);
		//expect(defensePlayer.hand.length).toBe(4);
		expect(nextDefensePlayer.hand.length).toBe(4);

		const nextTurnPlayer = game.getPlayerByPosition({playerId: offensePlayer.id, isNext:true});
		expect(nextTurnPlayer.turnState).toBe(ETurnState.inCardAction);
		expect(nextTurnPlayer.hand.length).toBe(5);
		expect(nextTurnPlayer).toBe(defensePlayer)


		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
