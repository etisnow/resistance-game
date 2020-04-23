import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from 'server/_playground/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCards} from '_integration/helpers';
import {ENotification} from 'shared/enum/notifications';


describe('fear test',  () => {

	it('fear card', () => {
		const [gameServer, game, neeronePlayer] = createMockGameServer();
		neeronePlayer.hand.splice(0,1);
		neeronePlayer.hand.splice(0,1, getCard(EEventID.fear));
		expect(neeronePlayer.hand[0].id).toBe(EEventID.fear);

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
		const analysisId = analysis.uniqueId;
		gameServer.playerAction({
			player:prevPlayer,
			cardUniqueId: analysis.uniqueId,
			selectedPlayerId:neeronePlayer.id,
			actionType: EPlayerActionType.cardTrade
		});
		analysis = find(prevPlayer.hand, {uniqueId: analysis.uniqueId});
		expect(analysis).toBe(undefined);
		let neeronesFear = find(neeronePlayer.hand, {id: EEventID.fear});
		expect(prevPlayer.turnState).toBe(ETurnState.idle);

		expect(neeronePlayer.turnState).toBe(ETurnState.inDefenseTrade);
		gameServer.playerAction({
			player:neeronePlayer,
			cardUniqueId: neeronesFear.uniqueId,
			selectedPlayerId:prevPlayer.id,
			actionType: EPlayerActionType.cardAct
		});

		//Игрок показывает карту нирону
		expect(neeronePlayer.socket.spy.mock.calls).toContainEqual(
			expect.arrayContaining(['notification', expect.objectContaining({
				type: ENotification.okayCard, cards: expect.arrayContaining([
					expect.objectContaining({id: EEventID.analysis})
				])
			})])
		);


		expect(neeronePlayer.hand).not.toContainEqual(expect.objectContaining({ uniqueId: neeronesFear.uniqueId }));
		//Не должно быть старой картой анализа, но должна быть новая
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
