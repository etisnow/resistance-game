import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {expectOkayCard, requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('oops test',  () => {

	it('oops card', () => {
		const [, game, offensePlayerMaybe, APlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const APlayer = requirePlayer(game, APlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		game.deck.splice(0,1, getPanic(EPanicID.oops));
		game.changeTurn(offensePlayer.id);

		expectOkayCard(APlayer, expect.arrayContaining(offensePlayer.hand))

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
