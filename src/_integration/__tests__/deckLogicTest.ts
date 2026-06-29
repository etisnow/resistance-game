import {EPlayerActionType} from 'shared/enum/playerActions';
import {ETurnState} from 'shared/enum/player';
import {createMockGameServer} from '_integration/createGameServer';
import {testPlayerAction} from '_integration/testPlayerActionsDecisions';
import {GameServer} from 'server/server/GameServer';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ICardAny} from 'shared/interfaces/cards';

let counter = 0;

function assertDefined<T>(value: T, message: string): asserts value is NonNullable<T> {
	if (value === null || value === undefined) throw new Error(message);
}

const cardUid = (card: ICardAny | undefined): string => {
	assertDefined(card, 'Нет карты для розыгрыша');
	assertDefined(card.uniqueId, 'У карты нет uniqueId');
	return card.uniqueId;
};

const testPlayerLogic = (gameServer: GameServer, game: Game, player: Player): void => {
	let randomCard = player.getRandomPlayableCard();
	if (player.turnState === ETurnState.inDefenseTrade) {
		testPlayerAction(gameServer, game, {
			player:player,
			cardUniqueId: cardUid(randomCard),
			actionType: EPlayerActionType.cardTrade
		});
	}
	randomCard = player.getRandomPlayableCard();
	testPlayerAction(gameServer, game, {
		player:player,
		cardUniqueId: cardUid(randomCard),
		actionType: EPlayerActionType.cardDiscard
	});

	//expect(checkAllDeckCardsTestEdition(game, false)).toBe(true);
	randomCard = player.getRandomPlayableCard();
	testPlayerAction(gameServer, game, {
		player:player,
		cardUniqueId: cardUid(randomCard),
		actionType: EPlayerActionType.cardTrade
	});

	counter ++;
	if (counter === 70) return;
	const nextPlayer = player.getNextPlayer();
	return testPlayerLogic(gameServer, game, nextPlayer)
}

describe('trade logic',  () => {
	it('deck should be consistent', () => {
		const [gameServer, game, APlayer] = createMockGameServer(true);
		assertDefined(APlayer, 'APlayer не найден');
		APlayer.hand.splice(0,1);
		game.changeTurn(APlayer.id);
		testPlayerLogic(gameServer, game, APlayer)
	});

});
