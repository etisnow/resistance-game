import {Game} from 'server/models/Game';
import {clone, concat, difference, each, filter, reduce} from 'lodash';
import {fullDeckObject, instantiateCard, handCardsCount} from 'shared/constant/cards';
import {ICardAny} from 'shared/interfaces/cards';
import {ECardType} from 'shared/enum/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ENotificationAction} from 'shared/enum/notifications';
import {Player} from 'server/models/Player';
import {initialDeck} from 'server/helpers/gameStarter';
import {debugLog} from 'server/helpers/util';
import {gameServer} from 'server/server/GameServer';
import {getSpyCalls} from '_integration/mockSocket';

export const checkAllDeckCards = (game: Game, _withPanics = true) => {
	if (gameServer.ignoreChecks) return true;
	const activePlayers = filter(game.players, p => p.state !== EPlayerState.door)

	const playersCount = Object.keys(activePlayers).length;

	const cardsOnHands = reduce(game.players, (acc: ICardAny[], player) => {
		if (player.state === EPlayerState.door) return acc;
		return concat(acc, player.hand);
	}, [] as ICardAny[]);

	let comparingDeck = clone(cardsOnHands);

	comparingDeck = concat([], clone(comparingDeck), clone(game.deck), clone(game.discardedDeck));

	if (comparingDeck.length !== initialDeck.length) {
		debugLog(`CARDS: ${comparingDeck.length}, BUT SHOULD BE: ${initialDeck.length}`, ' players ', playersCount)
		let diff = difference(comparingDeck, initialDeck);
		if (diff.length === 0) {
			diff = difference(initialDeck, comparingDeck);
		}
		debugLog('DECK DIFFERENCE', diff)

		throw new Error('Incorrect cards')
	} else {
		debugLog('CARDS IS FINE', initialDeck.length, ' players ', playersCount)
	}

	each(activePlayers, pl => {
		const playerHandLength = pl.hand.length;
		if (playerHandLength > handCardsCount && pl.turnState !== ETurnState.inCardAction && pl.turnState !== ETurnState.inCardActionProgress) {
			debugLog(`Аномальное количество карт у игрока ${pl.nickname} (${pl.turnState}) - ${playerHandLength} `, pl.hand);
			throw new Error('Player hand anomaly')
		}

	})

	return comparingDeck.length !== initialDeck.length

};

export const checkAllDeckCardsTestEdition = (game: Game, withPanics = true) => {

	const cardsOnHands = reduce(game.players, (acc: ICardAny[], player) => {
		if (player.state === EPlayerState.door) return acc;
		return concat(acc, player.hand);
	}, [] as ICardAny[])
	const fullCardsLength = cardsOnHands.length + game.deck.length + game.discardedDeck.length;

	const activePlayers = filter(game.players, p => p.state !== EPlayerState.door)

	const playersCount = Object.keys(activePlayers).length;

	const filteredDeck = reduce(fullDeckObject, (acc: ICardAny[], card: ICardAny) => {
		each(card.playersCount, (count) => {
			if (count <= playersCount) {
				if (!withPanics && card.type === ECardType.panic) {
				} else {
					acc.push(instantiateCard(card))
				}
			}
		});
		return acc
	}, [] as ICardAny[]);

	const cardsShouldBe = filteredDeck.length+1;

	each(game.discardedDeck, (cId) => {
		if (!cId) {
			throw new Error(cId + ' discarded!');
		}
	});
	each(game.deck, (cId) => {
		if (!cId) {
			throw new Error(cId + 'in the deck!');
		}
	});
	if (cardsShouldBe !== fullCardsLength) {
		console.error(`CARDS: ${fullCardsLength}, BUT SHOULD BE: ${cardsShouldBe}`, ' players ', playersCount)
		throw new Error('Incorrect cards')
	} else {
		debugLog('CARDS IS FINE', cardsShouldBe, ' players ', playersCount)
	}
	return cardsShouldBe === fullCardsLength;
};


// Test helper: fetch a player by id, asserting presence (keeps tests free of
// non-null assertions on the game.players index map).
export const requirePlayer = (game: Game, id: string | undefined): Player => {
	const player = id ? game.players[id] : undefined;
	if (!player) throw new Error(`Игрок не найден в игре: ${id}`);
	return player;
};

export const printPlayersStatuses = (game: Game) => {
	each(game.players, pl => {
		debugLog(pl.nickname, pl.turnState);
	})
}


export const printNotifications = (player: Player) => {
	each(getSpyCalls(player), ([type, event]) => {
		if (type !== 'notification') return;
		debugLog(event);
	})
}


export const expectOkayCard = (player: Player, cards: unknown, text: string | null = null) => {
	// Notifications carry cards as an object-map keyed by uniqueId (see formatCards);
	// tests express the expected cards as an array matcher, so compare against the
	// map's values.
	const match = getSpyCalls(player).some(([type, event]) => {
		if (type !== 'notification') return false;
		const notification = event as { type?: ENotificationAction; text?: string; cards?: Record<string, unknown> } | null;
		if (!notification || notification.type !== ENotificationAction.okayCard) return false;
		if (text && notification.text !== text) return false;
		if (cards) {
			const cardValues: unknown = notification.cards ? Object.values(notification.cards) : [];
			try {
				expect(cardValues).toEqual(cards);
			} catch (e) {
				return false;
			}
		}
		return true;
	});
	expect(match).toBe(true);
}
