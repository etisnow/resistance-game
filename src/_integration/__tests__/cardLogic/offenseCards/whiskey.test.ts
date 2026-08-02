import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {each, findLast, map} from 'lodash';
import {cardLogName} from 'shared/constant/cardNames';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {expectOkayCard, requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';


describe('whiskey test',  () => {

	it('whiskey card', () => {
		const [gameServer, game, offensePlayerMaybe, nextPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const nextPlayer = requirePlayer(game, nextPlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.whiskey));
		expect(offensePlayer.hand[0]?.id).toBe(EEventID.whiskey);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		let whiskey = offensePlayer.hand[0];

		expect(whiskey).not.toBe(undefined);
		if (!whiskey) throw new Error('whiskey card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: whiskey.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});



		//Игрок показывает все карты всем

		expectOkayCard(nextPlayer, expect.arrayContaining(
			map(offensePlayer.hand, (card) => expect.objectContaining({id: card.id}))
		))

/*		expect(nextPlayer.currentAction).toEqual(
			expect.objectContaining({
				type: ENotificationAction.okayCard,
				cards: expect.arrayContaining(
					map(offensePlayer.hand, (card) => expect.objectContaining({id: card.id}))
				)
			})
		);*/

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);

		//В логе перечислены реальные карты руки — чтобы потом можно было посмотреть, что показывали
		const whiskeyLog = findLast(game.gameLog, (entry) => entry.text.includes('слишком пьян'));
		expect(whiskeyLog).not.toBe(undefined);
		each(offensePlayer.hand, (handCard) => {
			expect(whiskeyLog?.text).toContain(cardLogName(handCard.id));
		});

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
