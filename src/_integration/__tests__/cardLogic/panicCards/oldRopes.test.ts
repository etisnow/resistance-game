import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';


describe('oldRopes test',  () => {

	it('oldRopes card', () => {
		const [, game, offensePlayerMaybe, APlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const APlayer = requirePlayer(game, APlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		APlayer.quarantine = 3;
		game.deck.splice(0,1, getPanic(EPanicID.oldRopes));
		game.changeTurn(offensePlayer.id);

		expect(APlayer.quarantine).toBe(0);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
