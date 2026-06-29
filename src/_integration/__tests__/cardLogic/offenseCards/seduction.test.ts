import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {requirePlayer} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('seduction test',  () => {

	it('seduction card self', () => {
		const [gameServer, game, offensePlayerMaybe, , BPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const BPlayer = requirePlayer(game, BPlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.seduction), getCard(EEventID.miss));
		expect(offensePlayer.hand[0]?.id).toBe(EEventID.seduction);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let seduction = offensePlayer.hand[0];
		let miss = offensePlayer.hand[1];

		expect(seduction).not.toBe(undefined);
		if (!seduction) throw new Error('seduction card not found');
		if (!miss) throw new Error('miss card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: seduction.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: BPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			actionType: EPlayerActionType.cardTrade,
			cardUniqueId: miss.uniqueId ?? undefined,
		});

		expect(BPlayer.turnState).toBe(ETurnState.inDefenseTrade);

		const BPlayerCard = BPlayer.getRandomPlayableCard();
		if (!BPlayerCard) throw new Error('BPlayer card not found');

		testPlayerAction(gameServer, game, {
			player:BPlayer,
			actionType: EPlayerActionType.cardTrade,
			cardUniqueId: BPlayerCard.uniqueId ?? undefined,
		});

		const nextPlayer = game.getPlayerByPosition({playerId:offensePlayer.id, isNext:true});
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
