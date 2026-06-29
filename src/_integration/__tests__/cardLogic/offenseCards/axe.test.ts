import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {requirePlayer} from '_integration/helpers';

describe('axe test',  () => {

	it('axe should break the door', () => {
		const [gameServer, game, defensePlayerMaybe, , , , , offensePlayerMaybe] = createMockGameServer();
		const defensePlayer = requirePlayer(game, defensePlayerMaybe?.id);
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		defensePlayer.hand.splice(0,1);
		defensePlayer.hand.splice(0,1, getCard(EEventID.axe));
		const defenseFirstCard = defensePlayer.hand[0];
		expect(defenseFirstCard?.id).toBe(EEventID.axe);

		offensePlayer.hand.splice(0,1, getCard(EEventID.barricade));
		const offenseFirstCard = offensePlayer.hand[0];
		expect(offenseFirstCard?.id).toBe(EEventID.barricade);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		const barricade = offensePlayer.hand[0];
		expect(barricade).not.toBe(undefined);
		if (!barricade) throw new Error('barricade card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: barricade.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: defensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		//Должна поставиться стена
		const door = offensePlayer.getNextPlayer();
		expect(door.state).toBe(EPlayerState.door);
		//Не должно быть старой картой barricade, но должна быть новая
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));

		//Оффенс игрок не меняется картами потому что дальше дверь
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		//Т.к у defense теперь ход, у него 5 карт
		expect(defensePlayer.turnState).toBe(ETurnState.inCardAction);
		expect(defensePlayer.hand.length).toBe(5);

		const axe = defensePlayer.hand[0];
		if (!axe) throw new Error('axe card not found');

		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			cardUniqueId: axe.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:defensePlayer,
			selectedPlayerId: door.id,
			actionType: EPlayerActionType.playerSelect
		});

		const prevPlayer = game.getPlayerByPosition({playerId:defensePlayer.id, isNext: false});

		//Предыдущий игрок не должен быть дверью
		expect(prevPlayer.state).not.toBe(EPlayerState.door);


		expect(defensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);


	});

	it('axe should break the quarantine', () => {
		const [gameServer, game, defensePlayerMaybe] = createMockGameServer();
		const defensePlayer = requirePlayer(game, defensePlayerMaybe?.id);

		defensePlayer.hand.splice(0,1);
		const offensePlayer = game.getPlayerByPosition({playerId:defensePlayer.id, isNext:false});


		game.changeTurn(offensePlayer.id);


		offensePlayer.hand.splice(0,1, getCard(EEventID.axe));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.axe);



		offensePlayer.quarantine = 3;
		expect(offensePlayer.quarantine).toBe(3);
		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		const axe = offensePlayer.hand[0];
		expect(axe).not.toBe(undefined);
		if (!axe) throw new Error('axe card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: axe.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: offensePlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);
		expect(offensePlayer.quarantine).toBe(0);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
		console.log("OK3")
	});

});
