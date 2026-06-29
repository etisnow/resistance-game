import {getPanic} from 'shared/constant/cards';
import {EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {each, isEqual} from 'lodash';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {requirePlayer} from '_integration/helpers';
import {notifyPlayerDiscardCards} from 'server/helpers/cardActions/panic/forgetfulness';
import {ENotificationAction} from 'shared/enum/notifications';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {Player} from 'server/models/Player';
import INotificationAction from 'shared/interfaces/notification';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';


const getLastForgetfullnessNotificaitonCards = (offensePlayer: Player): INotificationAction | null => {
	return offensePlayer.currentAction;
}

const getFirstNotificationCard = (notification: INotificationAction | null): ICardEvent | ICardPanic => {
	if (!notification || notification.type !== ENotificationAction.selectCard) {
		throw new Error('Ожидалось уведомление selectCard с картами');
	}
	const [firstCard] = Object.values(notification.cards);
	if (!firstCard) {
		throw new Error('Ожидалась хотя бы одна карта в уведомлении');
	}
	return firstCard;
}


describe('forgetfulness test',  () => {

	it('forgetfulness card', () => {
		const [gameServer, game, offensePlayerMaybe, _door, BPlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const BPlayer = requirePlayer(game, BPlayerMaybe?.id);
		BPlayer.quarantine = 3;
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.forgetfulness));
		game.changeTurn(offensePlayer.id);


		let playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		let forgetfulnessNotification = getLastForgetfullnessNotificaitonCards(offensePlayer)
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);

		const firstCard = getFirstNotificationCard(forgetfulnessNotification);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: firstCard.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardSelect
		});

		const contextAfterFirst = game.turnContext;
		if (!contextAfterFirst || contextAfterFirst.type !== ETurnContextType.forgetfullnessSelect) {
			throw new Error('Ожидался контекст forgetfullnessSelect');
		}
		expect(firstCard.uniqueId != null && contextAfterFirst.cards.includes(firstCard.uniqueId)).toBe(true)

		playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		forgetfulnessNotification = getLastForgetfullnessNotificaitonCards(offensePlayer)
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);

		const secondCard = getFirstNotificationCard(forgetfulnessNotification);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: secondCard.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardSelect
		});

		const contextAfterSecond = game.turnContext;
		if (!contextAfterSecond || contextAfterSecond.type !== ETurnContextType.forgetfullnessSelect) {
			throw new Error('Ожидался контекст forgetfullnessSelect');
		}
		expect(secondCard.uniqueId != null && contextAfterSecond.cards.includes(secondCard.uniqueId)).toBe(true)
		playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		forgetfulnessNotification = getLastForgetfullnessNotificaitonCards(offensePlayer)
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);

		const thirdCard = getFirstNotificationCard(forgetfulnessNotification);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: thirdCard.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardSelect
		});

		const discardedCardIds = [firstCard, secondCard, thirdCard].map(c => c.uniqueId);
		each(offensePlayer.hand, (handCard) => {
			expect(discardedCardIds).not.toContain(handCard.uniqueId)
		})

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});



});
