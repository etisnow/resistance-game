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


const getForgetfullnessNotification = (offensePlayer: Player): INotificationAction | null => {
	return offensePlayer.currentAction;
}

const getNotificationCardIds = (notification: INotificationAction | null, count: number): string[] => {
	if (!notification || notification.type !== ENotificationAction.selectCards) {
		throw new Error('Ожидалось уведомление selectCards с картами');
	}
	const cardIds = Object.values(notification.cards)
		.map(card => card.uniqueId)
		.filter((uniqueId): uniqueId is string => !!uniqueId)
		.slice(0, count);
	if (cardIds.length !== count) {
		throw new Error(`Ожидалось хотя бы ${count} карты в уведомлении`);
	}
	return cardIds;
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

		// Уведомление одно на весь обмен: игрок отмечает в нём три карты и
		// подтверждает их разом.
		const playerNotificationCards = notifyPlayerDiscardCards({game, player: offensePlayer});
		const forgetfulnessNotification = getForgetfullnessNotification(offensePlayer);
		expect(isEqual(playerNotificationCards, forgetfulnessNotification)).toBe(true);
		expect(forgetfulnessNotification?.type).toBe(ENotificationAction.selectCards);

		const handSizeBefore = offensePlayer.hand.length;
		const discardedCardIds = getNotificationCardIds(forgetfulnessNotification, 3);

		testPlayerAction(gameServer, game, {
			player: offensePlayer,
			cardUniqueIds: discardedCardIds,
			actionType: EPlayerActionType.cardsSelect
		});

		each(offensePlayer.hand, (handCard) => {
			expect(discardedCardIds).not.toContain(handCard.uniqueId)
		})
		// Сколько отдал, столько и взял.
		expect(offensePlayer.hand.length).toBe(handSizeBefore);

		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext?.type).toBe(ETurnContextType.trade)

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);

	});

	it('не принимает выбор не из тех карт и не в том количестве', () => {
		const [gameServer, game, offensePlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);

		game.deck.splice(0,1, getPanic(EPanicID.forgetfulness));
		game.changeTurn(offensePlayer.id);

		const notification = getForgetfullnessNotification(offensePlayer);
		const cardIds = getNotificationCardIds(notification, 3);
		const handBefore = offensePlayer.hand.map(card => card.uniqueId);

		// Двух карт мало, одна и та же дважды — тоже не выбор, а чужого id в
		// уведомлении нет: ход должен остаться на месте.
		const badSelections = [
			cardIds.slice(0, 2),
			[cardIds[0] ?? '', cardIds[0] ?? '', cardIds[1] ?? ''],
			[cardIds[0] ?? '', cardIds[1] ?? '', 'card_unknown'],
		];
		each(badSelections, (cardUniqueIds) => {
			gameServer.playerAction({
				player: offensePlayer,
				actionType: EPlayerActionType.cardsSelect,
				cardUniqueIds,
			});
			expect(offensePlayer.hand.map(card => card.uniqueId)).toEqual(handBefore);
			expect(game.turnContext?.type).toBe(ETurnContextType.forgetfullnessSelect);
		});
	});



});
