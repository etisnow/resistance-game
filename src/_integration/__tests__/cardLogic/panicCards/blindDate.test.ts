import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {requirePlayer} from '_integration/helpers';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('blindDate test',  () => {

	it('blindDate card', () => {
		const [gameServer, game, offensePlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.whiskey));
		expect(offensePlayer.hand[0]?.id).toBe(EEventID.whiskey);

		game.deck.splice(0,1, getPanic(EPanicID.blindDate));
		game.changeTurn(offensePlayer.id);


		const whiskey = offensePlayer.hand[0];
		if (!whiskey) throw new Error('whiskey card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: whiskey.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardSelect
		});

		// After the panic-driven swap the player proceeds to the normal
		// end-of-turn trade with the next neighbour (same as other panics, e.g. oops).
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(offensePlayer.hand.length).toBe(4);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
