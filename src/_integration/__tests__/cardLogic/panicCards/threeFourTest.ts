import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import { filter } from 'lodash';


describe('threeFour test',  () => {

	it('threeFour card', () => {
		const [, game, offensePlayerMaybe, doorMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const door = requirePlayer(game, doorMaybe?.id);
		door.state = EPlayerState.door;
		offensePlayer.hand.splice(0,1);
		game.deck.splice(0,1, getPanic(EPanicID.threeFour));
		game.changeTurn(offensePlayer.id);

		const newPlayerList = filter(game.playersList, pId => {
			const pl = requirePlayer(game, pId);
			return pl.state === EPlayerState.dummy
		});

		expect(game.playersList).toStrictEqual(newPlayerList);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);
		//Так как мы зафейкали дверь мы не можем оценить количество карт
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
