import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from 'server/_playground/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {find, map} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {checkAllDeckCards} from '_integration/helpers';
import {ENotification} from 'shared/enum/notifications';
import {Simulate} from 'react-dom/test-utils';
import play = Simulate.play;


describe('whiskey test',  () => {

	it('whiskey card', () => {
		const [gameServer, game, offensePlayer, nextPlayer] = createMockGameServer();
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.whiskey));
		expect(offensePlayer.hand[0].id).toBe(EEventID.whiskey);

		game.deck.splice(0,1, getPanic(EPanicID.blindDate));
		game.changeTurn(offensePlayer.id);





		//expect(checkAllDeckCards(game, false)).toBe(true);

	});


});
