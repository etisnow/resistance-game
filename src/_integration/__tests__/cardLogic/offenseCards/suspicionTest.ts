import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {requirePlayer} from '_integration/helpers';
import {getSpyCalls} from '_integration/mockSocket';
import type {INotificationActionOkayCard} from 'shared/interfaces/notification';
import type {ICardEvent, ICardPanic} from 'shared/interfaces/cards';


describe('suspicion test',  () => {

	it('suspicion card', () => {
		const [gameServer, game, offensePlayerMaybe, nextPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const nextPlayer = requirePlayer(game, nextPlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,1, getCard(EEventID.suspicion));
		const firstCard = offensePlayer.hand[0];
		expect(firstCard?.id).toBe(EEventID.suspicion);

		game.changeTurn(offensePlayer.id);

		expect(offensePlayer.turnState).toBe(ETurnState.inCardAction);
		const suspicion = offensePlayer.hand[0];

		expect(suspicion).not.toBe(undefined);
		if (!suspicion) throw new Error('suspicion card not found');
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: suspicion.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardAct
		});
		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: nextPlayer.id,
			actionType: EPlayerActionType.playerSelect
		});


		const suspicionNotification = getSpyCalls(offensePlayer).find(([type, event]) => {
			if (type !== 'notification') return false;
			const notification = event as INotificationActionOkayCard | null;
			if (!notification || notification.type !== ENotificationAction.okayCard) return false;
			const {cards} = notification;
			if (cards) return true;
			return false;
		})

		expect(suspicionNotification).not.toBe(undefined);
		if (!suspicionNotification) throw new Error('suspicion notification not found');

		const [, payload] = suspicionNotification;
		const {cards} = payload as INotificationActionOkayCard;
		const [suspictedCard] = Object.values(cards) as (ICardEvent | ICardPanic)[]

		expect(suspictedCard).not.toBe(undefined);
		if (!suspictedCard) throw new Error('suspected card not found');

		expect(nextPlayer.hand).toContainEqual(
			expect.objectContaining({
				uniqueId: suspictedCard.uniqueId
			})
		);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)
		expect(offensePlayer.hand.length).toBe(4);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});


});
