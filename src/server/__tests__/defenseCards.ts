import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from 'server/_playground/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';


describe('defense cards',  () => {



	it('fear card', () => {
		const [gameServer, game, neeronePlayer] = createMockGameServer();
		neeronePlayer.hand.splice(0,1);
		neeronePlayer.hand.splice(0,1, getCard(EEventID.fear));
		expect(neeronePlayer.hand[0].id).toBe(EEventID.fear);


		const prevPlayer = game.getPlayerByPosition({isNext: false, playerId: neeronePlayer.id});
		prevPlayer.hand.splice(0,1);
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
		barricade = find(prevPlayer.hand, {id: EEventID.barricade});
		expect(barricade).toBe(undefined);
		expect(prevPlayer.turnState).toBe(ETurnState.inOffenseTrade);
		let analysis = find(prevPlayer.hand, {id: EEventID.analysis});
		gameServer.playerAction({
			player:prevPlayer,
			cardUniqueId: analysis.uniqueId,
			selectedPlayerId:neeronePlayer.id,
			actionType: EPlayerActionType.cardTrade
		});
		analysis = find(prevPlayer.hand, {id: EEventID.analysis});
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

	});


});


