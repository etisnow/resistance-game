import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from 'server/_playground/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCards} from '_integration/helpers';
import {ENotification} from 'shared/enum/notifications';


describe('nothanks test',  () => {

	it('nothanks card', () => {
		const [gameServer, game, neeronePlayer] = createMockGameServer();
		neeronePlayer.hand.splice(0,1);
		neeronePlayer.hand.splice(0,1, getCard(EEventID.noThanks));
		expect(neeronePlayer.hand[0].id).toBe(EEventID.noThanks);

		const prevPlayer = game.getPlayerByPosition({isNext: false, playerId: neeronePlayer.id})
		prevPlayer.hand.splice(0,2, getCard(EEventID.analysis), getCard(EEventID.barricade));

		game.changeTurn(prevPlayer.id);

		expect(prevPlayer.turnState).toBe(ETurnState.inCardAction);
		let barricade = find(prevPlayer.hand, {id: EEventID.barricade});

		expect(barricade).not.toBe(undefined);
		gameServer.playerAction({
			player:prevPlayer,
			cardUniqueId: barricade.uniqueId,
			actionType: EPlayerActionType.cardDiscard
		});


		expect(prevPlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: barricade.uniqueId}));
		expect(prevPlayer.turnState).toBe(ETurnState.inOffenseTrade);
		let analysis = find(prevPlayer.hand, {id: EEventID.analysis});
		const analysisId = analysis.uniqueId
		gameServer.playerAction({
			player:prevPlayer,
			cardUniqueId: analysis.uniqueId,
			selectedPlayerId:neeronePlayer.id,
			actionType: EPlayerActionType.cardTrade
		});
		analysis = find(prevPlayer.hand, {uniqueId: analysis.uniqueId});
		expect(analysis).toBe(undefined);
		let noThanksCard = find(neeronePlayer.hand, {id: EEventID.noThanks});
		expect(prevPlayer.turnState).toBe(ETurnState.idle);

		expect(neeronePlayer.turnState).toBe(ETurnState.inDefenseTrade);
		gameServer.playerAction({
			player:neeronePlayer,
			cardUniqueId: noThanksCard.uniqueId,
			selectedPlayerId:prevPlayer.id,
			actionType: EPlayerActionType.cardAct
		});


		expect(neeronePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: noThanksCard.uniqueId }));
		//У него не должно быть той карты анализа, но должна появиться новая
		expect(prevPlayer.hand).not.toContainEqual(expect.objectContaining({uniqueId: analysisId}));
		expect(prevPlayer.hand).toContainEqual(expect.objectContaining({id: EEventID.analysis}));

		expect(neeronePlayer.turnState).toBe(ETurnState.inCardAction);
		expect(prevPlayer.turnState).toBe(ETurnState.idle);
		expect(prevPlayer.hand.length).toBe(4);

		//т.к теперь ходит нирон, у него 5 карт  на руке
		expect(neeronePlayer.hand.length).toBe(5);
		expect(checkAllDeckCards(game, false)).toBe(true);

	});


});
