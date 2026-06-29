import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {expectOkayCard, requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ENotificationAction} from 'shared/enum/notifications';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('onlyBetweenUs test',  () => {

	it('onlyBetweenUs card', () => {
		const [gameServer, game, offensePlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		game.deck.splice(0,1, getPanic(EPanicID.onlyBetweenUs));
		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.playerSelect,
				playersToSelect: expect.arrayContaining(offensePlayer.getPlayabeNeighbours())
			})
		);
		const neighbourId = offensePlayer.getPlayabeNeighbours()[0];
		const selectedPlayer = requirePlayer(game, neighbourId);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: selectedPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});

		expectOkayCard(selectedPlayer, expect.arrayContaining(offensePlayer.hand))


		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade);
		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
