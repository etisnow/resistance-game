import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {requirePlayer} from '_integration/helpers';

describe('barricade test',  () => {

	it('last player acts to first', () => {
		const [gameServer, game, defensePlayerMaybe, , , , , offensePlayerMaybe] = createMockGameServer();
		const defensePlayer = requirePlayer(game, defensePlayerMaybe?.id);
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		defensePlayer.hand.splice(0,1);

		//const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id});
		offensePlayer.hand.splice(0,1, getCard(EEventID.barricade));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.barricade);

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
		const door = game.getPlayerByPosition({playerId: offensePlayer.id, isNext:true});
		expect(door.state).toBe(EPlayerState.door);
		//Не должно быть старой картой barricade, но должна быть новая
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));

		//Оффенс игрок не меняется картами потому что дальше дверь
		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(offensePlayer.hand.length).toBe(4);

		//Т.к у defense теперь ход, у него 5 карт
		expect(defensePlayer.turnState).toBe(ETurnState.inCardAction);
		expect(defensePlayer.hand.length).toBe(5);

		//т.к теперь ходит нирон, у него 5 карт  на руке
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('last player acts to prev', () => {
		const [gameServer, game, fistPlayerMaybe, , defensePlayerMaybe, offensePlayerMaybe] = createMockGameServer();
		const fistPlayer = requirePlayer(game, fistPlayerMaybe?.id);
		const defensePlayer = requirePlayer(game, defensePlayerMaybe?.id);
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		fistPlayer.hand.splice(0,1);

		//const offensePlayer = game.getPlayerByPosition({isNext: false, playerId: defensePlayer.id});
		offensePlayer.hand.splice(0,1, getCard(EEventID.barricade));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.barricade);

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
		const door = game.getPlayerByPosition({playerId: offensePlayer.id, isNext:false});
		expect(door.state).toBe(EPlayerState.door);
		//Не должно быть старой картой barricade, но должна быть новая
		expect(offensePlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));

		//Оффенс игрок не меняется картами потому что дальше дверь
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);

		//Т.к у defense теперь ход, у него 5 карт
		expect(defensePlayer.turnState).toBe(ETurnState.idle);
		expect(defensePlayer.hand.length).toBe(4);

		//т.к теперь ходит нирон, у него 5 карт  на руке
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

});
