import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {createMockGameServer} from '_integration/createGameServer';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {requirePlayer} from '_integration/helpers';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {Player} from 'server/models/Player';
import INotificationAction from 'shared/interfaces/notification';


const getLastFriendshipNotificaiton = (offensePlayer: Player): INotificationAction | null => {
	return offensePlayer.currentAction;
/*	const forgetfulnessNotification = findLast(offensePlayer.socket.spy.mock.calls, ([type, event]) => {
		if (type !== 'notification') return false;
		if (event.type !== ENotificationAction.playerSelect) return false;
		const {playersToSelect} = event;
		if (playersToSelect) return true;
		return false;
	})
	return forgetfulnessNotification[1]*/
}

describe('friendship test',  () => {

	it('friendship test', () => {
		const [gameServer, game, offensePlayerMaybe, APlayerMaybe] = createMockGameServer();
		const offensePlayer = requirePlayer(game, offensePlayerMaybe?.id);
		const APlayer = requirePlayer(game, APlayerMaybe?.id);
		offensePlayer.hand.splice(0,1);
		offensePlayer.hand.splice(0,2, getCard(EEventID.seduction), getCard(EEventID.miss));

		const missCard = offensePlayer.hand[1];
		expect(offensePlayer.hand[0]?.id).toBe(EEventID.seduction);

		game.deck.splice(0,1, getPanic(EPanicID.friendship));
		game.changeTurn(offensePlayer.id);

		//Проверяем получил ли человек уведомление
		const notification = getLastFriendshipNotificaiton(offensePlayer)
		expect(notification).not.toBe(undefined);

		//Проверяем есть ли контекст friendshipSeduction (panic-driven seduction,
		//distinct from the seduction event card because no card is discarded)
		expect(game.turnContext).not.toBe(undefined);
		expect(game.turnContext?.type).toBe(ETurnContextType.friendshipSeduction);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			selectedPlayerId: APlayer.id,
			actionType: EPlayerActionType.playerSelect
		});
		expect(offensePlayer.turnState).toBe(ETurnState.inOffenseTrade);
		expect(game.turnContext).not.toBe(undefined);
		const tradeContext = game.turnContext;
		if (!tradeContext || tradeContext.type !== ETurnContextType.trade) {
			throw new Error('Ожидался контекст trade');
		}
		expect(tradeContext.type).toBe(ETurnContextType.trade);
		expect(tradeContext.offensePlayer).toBe(offensePlayer);
		expect(tradeContext.defensePlayer).toBe(APlayer);

		testPlayerAction(gameServer, game, {
			player:offensePlayer,
			cardUniqueId: missCard?.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardTrade
		});

		expect(offensePlayer.turnState).toBe(ETurnState.idle);
		expect(APlayer.turnState).toBe(ETurnState.inDefenseTrade);

		const randomDefenseCard = APlayer.getRandomPlayableCard();
		testPlayerAction(gameServer, game, {
			player:APlayer,
			cardUniqueId: randomDefenseCard?.uniqueId ?? undefined,
			actionType: EPlayerActionType.cardTrade
		});

		expect(offensePlayer.hand).toContainEqual(
			expect.objectContaining({uniqueId: randomDefenseCard?.uniqueId})
		)
		expect(APlayer.hand).toContainEqual(
			expect.objectContaining({id: missCard?.id})
		)

		const nextPlayer = offensePlayer.getNextPlayer();
		expect(nextPlayer.turnState).toBe(ETurnState.inCardAction);

		//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	});


});
