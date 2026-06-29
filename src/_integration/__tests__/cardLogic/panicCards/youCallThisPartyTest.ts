import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import { filter, each } from 'lodash';


describe('youcallthis party test',  () => {

	it('youcallthis party card', () => {
		const [, game, offensePlayerMaybe, doorMaybe, quarantinedMaybe, DPlayerMaybe, EPlayerMaybe, FPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const door = requirePlayer(game, doorMaybe?.id);
		const quarantined = requirePlayer(game, quarantinedMaybe?.id);
		const DPlayer = requirePlayer(game, DPlayerMaybe?.id);
		const EPlayer = requirePlayer(game, EPlayerMaybe?.id);
		const FPlayer = requirePlayer(game, FPlayerMaybe?.id);
		door.state = EPlayerState.door;
		quarantined.quarantine = 3;
		offensePlayer.hand.splice(0,1);
		game.deck.splice(0,1, getPanic(EPanicID.youCallThisParty));
		game.changeTurn(offensePlayer.id);



		//Проверяем убитые двери
		const newPlayerList = filter(game.playersList, pId => {
			const pl = requirePlayer(game, pId);
			return pl.state === EPlayerState.dummy
		});
		expect(game.playersList).toStrictEqual(newPlayerList);

		//Проверяем отсутствие карантина
		each(game.playersList, pId => {
			const pl = requirePlayer(game, pId);
			expect(pl.quarantine).toBe(0);
		});



		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);

		expect(game.playersList).toStrictEqual([quarantined.id, offensePlayer.id, EPlayer.id, DPlayer.id, FPlayer.id])

		//Так как мы зафейкали дверь мы не можем оценить количество карт
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
