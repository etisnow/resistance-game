import {gameServer} from 'server/server/GameServer';
import {createDoor, createMockSocket, createPlayer} from '_integration/mockSocket';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {getCard, getPanic} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';
import {each} from 'lodash';
import {ETurnState} from 'shared/enum/player';

const testOffenseCard = ({player, cards}) => {
		const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
		gameServer.startGame({player: host});

		//Подтасовываем карту
		const pl = game.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);
		game.updateGame();
}

const testAxeCard = ({player, cards}) => {
		const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
		gameServer.startGame({player: host});

		//Подтасовываем карту
		const pl = game.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);
		host.quarantine = 3;
		game.updateGame();
}

const testDefenseCard = ({player, cards, againstCardId}) => {
		const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
		gameServer.startGame({player: host});

		//Подтасовываем карту
		const pl = game.players[player.id];
		each(cards, (card) => {
			pl.getCard(card)
		})
		//pl.getCard()
		//pl.hand.splice(0,cards.length, ...cards);

		const randomdiscardCard = host.hand[0];
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardDiscard, cardUniqueId: randomdiscardCard.uniqueId});

		host.hand.splice(0,1, getCard(againstCardId));
		const randomTradeCard = host.hand[0];
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardTrade, cardUniqueId: randomTradeCard.uniqueId});
}




const testDefenseActionCard = ({player, cards, againstCardId}) => {
		const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
		gameServer.startGame({player: host});

		//Подтасовываем карту
		const pl = game.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);


		const swapCard = getCard(againstCardId)
		host.hand.splice(0,1, swapCard);
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardAct, cardUniqueId: swapCard.uniqueId});


		gameServer.playerAction({player: host, actionType: EPlayerActionType.playerSelect, selectedPlayerId: player.id});
};

const testPanic = ({player, card}: {player:Player, card: ICardPanic}) => {
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
	gameServer.startGame({player: host});

	game.deck.unshift(card);
	player.getCard(getCard(EEventID.infect));
	player.getCard(getCard(EEventID.infect));
	game.changeTurn(player.id)
}

const interfaceTest = ({player, card}: {player:Player, card: ICardEvent}) => {
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});

	gameServer.startGame({player: host});

	each(game.players, pl => pl.isReady = true);
	gameServer.startGame({player});
	player.getCard(getCard(EEventID.tenacity));
	player.getCard(getCard(EEventID.tenacity));
}


export function mockGameProcess(player) {
	setTimeout(() => {
		gameServer.isMock = true;
		gameServer.ignoreChecks = true;

		//testDefenseCard({player, cards: [
		//	getCard(EEventID.infect),
		//	getCard(EEventID.fear),
		//	getCard(EEventID.noThanks),
		//	getCard(EEventID.miss),
		//], againstCardId: EEventID.barricade});


		//testDefenseActionCard({player, cards: [
		//	getCard(EEventID.leaveMeAlone),
		//	getCard(EEventID.noFire),
		//], againstCardId: EEventID.flamethrower})


		//testOffenseCard({player, cards: [
		//	getCard(EEventID.suspicion),
		//	getCard(EEventID.tenacity),
		//	getCard(EEventID.whiskey),
		//	getCard(EEventID.seduction),
		//]})

		//testAxeCard({player, cards: [
		//	getCard(EEventID.axe),
		//	getCard(EEventID.barricade),
		//]})

		testPanic({player, card: getPanic(EPanicID.chainReaction)})
		//interfaceTest({player, card: getCard(EEventID.suspicion)})

	}, 500)
}
