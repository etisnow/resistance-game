import {Game} from 'server/models/Game';
import {fullDeckObject, getCard, handCardsCount} from 'shared/constant/cards';
import {concat, each, find, range, reduce} from 'lodash';
import {ICard} from 'shared/interfaces/cards';
import { shuffle} from 'server/helpers/util';
import * as chroma from 'chroma-js';
import {gameServer} from 'server/server/GameServer';
import {ECardType, EEventID} from 'shared/enum/cards';

export const gameStarter = (game: Game) => {
	const players = game.players;

	// Получаем все игровые карты

	const playersCount = Object.keys(players).length || 0;
	if (!playersCount) throw new Error("количество игроков равно нулю");

	const filteredDeck = reduce(fullDeckObject, (acc, card:ICard) => {
		each(card.playersCount, (count) => {
			if (count <= playersCount) {
				acc.push(getCard(card.id))
			}
		});
		return acc
	}, []);

	const shuffledDeck = shuffle(filteredDeck);

	const [playableCards, otherCards] = reduce(shuffledDeck, ([events, other], card: ICard) => {
		if (card.type === ECardType.event && card.id !== 'injure' && card.id !== 'thing') {
			events.push(card);
		} else {
			//REMOVE TEST PANICS
			if (card.type !== ECardType.panic) {
			other.push(card);
			}
		}
		return [events, other]
	}, [[], []]);


	//Один точно будет нечто, поэтому берем playersCount - 1
	const totalCountWithoutThing = (playersCount * handCardsCount) - 1;
	let playersHands = playableCards.slice(0, totalCountWithoutThing);
	//Берем первые карты из отфильтрованной колоды с учтетом -1 для нечто
	playableCards.splice(0, totalCountWithoutThing);
	//Совмещаем остатки всех массивов в один и еще раз перетасуем
	const otherDeck = shuffle(concat([], playableCards, otherCards));
	//Добавляем карту нечто к раздаче
	playersHands.push(getCard('thing'));
	//Еще раз шафлим массив с учетом нечто
	playersHands = shuffle(playersHands);

	game.deck = otherDeck;
	const playerList = Object.keys(game.players);
	//game.playersList = shuffle(playerList);
	game.playersList = playerList;



	//Выдаем игрокам на руки карты
	const playersIdsArray = Object.keys(game.players)
	each(range(playersCount), (playerIndex) => {
		const currentPlayerId = playersIdsArray[playerIndex];
		const currentPlayer = game.players[currentPlayerId];

		let currentPlayerHand = playersHands.slice(0, handCardsCount);
		playersHands.splice(0, handCardsCount);
		currentPlayer.hand = currentPlayerHand;
		each(currentPlayerHand, (card: ICard) => {
			if (card.id === 'thing') {
				currentPlayer.isInjured = true;
				currentPlayer.isThing = true;
			}
		});
	});
	game.changeTurn(game.playersList[0]);

	const playerColors = chroma.cubehelix()
		.start(200)
		.rotations(-0.5)
		.lightness([0.4, 0.6])
		.scale()
		.colors(playersIdsArray.length);

	each(playersIdsArray, (playerId, index) => {
		const color = playerColors[index];
		const secondColor = chroma.mix(color, '00a70c').hex();
		game.players[playerId].color = `linear-gradient(${color}, ${secondColor})`
	});

	if (gameServer.isMock) {
		let neerone = find(game.players, ({nickname}) => {return nickname === 'neerone';});
		if (!neerone) neerone = game.players[0];
		//neerone.quarantine = 3;
		neerone.hand.splice(0,1);
		neerone.hand.splice(0,1);
		neerone.hand.splice(0,1);
		neerone.hand.splice(0,1);
		neerone.hand.push(getCard(EEventID.quarantine));
		neerone.hand.push(getCard(EEventID.axe));
		neerone.hand.push(getCard(EEventID.lookaround));
		neerone.hand.push(getCard(EEventID.analysis));
		//console.log(neerone);
		game.changeTurn(neerone.id);
		//game.turnPlayerId = neerone.id;
		//game.players['player_1']
	}

};
