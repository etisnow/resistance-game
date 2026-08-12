import {Game} from 'server/models/Game';
import {fullDeckObject, instantiateCard, handCardsCount, thingCard} from 'shared/constant/cards';
import {concat, each, map, range, reduce, clone} from 'lodash';
import {avatarsCount} from 'shared/constant/avatars';
import {ICardAny, ICardEvent} from 'shared/interfaces/cards';
import {shuffle} from 'server/helpers/util';
import {gameServer} from 'server/server/GameServer';
import {ECardType, EEventID} from 'shared/enum/cards';

export let initialDeck: ICardAny[] = [];

export const gameStarter = (game: Game) => {
	const players = game.players;

	// Получаем все игровые карты

	const playersCount = Object.keys(players).length || 0;
	if (!playersCount) throw new Error("количество игроков равно нулю");

	const filteredDeck = reduce(fullDeckObject, (acc: ICardAny[], card: ICardAny) => {
		each(card.playersCount, (count) => {
			if (count <= playersCount) {
				acc.push(instantiateCard(card))
			}
		});
		return acc
	}, [] as ICardAny[]);

	const shuffledDeck = shuffle(filteredDeck, game.rng);

	const [playableCards, otherCards] = reduce(shuffledDeck, ([events, other], card) => {
		if (card.type === ECardType.event && card.id !== EEventID.infect && card.id !== EEventID.thing) {
			events.push(card);
		} else {
			if (gameServer.isMock && card.type === ECardType.panic) {
			} else {
				other.push(card);
			}
		}
		return [events, other]
	}, [[] as ICardEvent[], [] as ICardAny[]]);


	//Один точно будет нечто, поэтому берем playersCount - 1
	const totalCountWithoutThing = (playersCount * handCardsCount) - 1;
	let playersHands = playableCards.slice(0, totalCountWithoutThing);
	//Берем первые карты из отфильтрованной колоды с учтетом -1 для нечто
	playableCards.splice(0, totalCountWithoutThing);
	//Совмещаем остатки всех массивов в один и еще раз перетасуем
	const otherDeck = shuffle(concat([], playableCards, otherCards), game.rng);
	//Добавляем карту нечто к раздаче
	playersHands.push(thingCard);
	//Еще раз шафлим массив с учетом нечто
	playersHands = shuffle(playersHands, game.rng);

	game.deck = otherDeck;
	const playerList = Object.keys(game.players);
	if (gameServer.isMock) {
		game.playersList = playerList;
	} else {
		game.playersList = shuffle(playerList, game.rng);
	}



	//Выдаем игрокам на руки карты
	const playersIdsArray = Object.keys(game.players)
	each(range(playersCount), (playerIndex) => {
		const currentPlayerId = playersIdsArray[playerIndex];
		const currentPlayer = currentPlayerId ? game.players[currentPlayerId] : undefined;
		if (!currentPlayer) return;

		const currentPlayerHand = playersHands.slice(0, handCardsCount);
		playersHands.splice(0, handCardsCount);
		currentPlayer.hand = currentPlayerHand;
		each(currentPlayerHand, (card: ICardEvent) => {
			if (card.id === EEventID.thing) {
				currentPlayer.isInfected = true;
				currentPlayer.isThing = true;
			}
		});
	});

	initialDeck = clone(game.deck);

	// Лица раздаём вразнобой: список аватарок один и тот же, и без тасовки за
	// каждым столом сидели бы одни и те же люди в одном и том же порядке.
	// Игроков может оказаться больше, чем лиц, — тогда список идёт по второму
	// кругу, но уже в другом порядке, и одинаковые лица расходятся по столу.
	const avatarDeck = concat(
		[],
		...map(range(Math.ceil(playersCount / avatarsCount)), () => shuffle(range(avatarsCount), game.rng)),
	);

	each(playersIdsArray, (playerId, index) => {
		const player = game.players[playerId];
		if (!player) return;
		initialDeck = concat([], clone(initialDeck), clone(player.hand))
		player.color = index+''
		player.avatar = avatarDeck[index] + ''
	});

};
