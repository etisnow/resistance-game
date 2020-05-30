import socketIO from "socket.io";
import {gameServer} from 'server/server/GameServer';
import {createMockSocket} from '_integration/mockSocket';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {getCard, getPanic} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';
import {each} from 'lodash';

const testOffenseCard = ({socket, cards}) => {
		const [game, host] = gameServer.createGame({nickname: 'neerone', socket});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
		gameServer.forceStartGame({player: host});

		//Подтасовываем карту
		const pl = game.players[host.id];
		pl.hand.splice(0,cards.length, ...cards);
		game.updateGame();
}

const testDefenseCard = ({socket, cards, againstCardId}) => {
		const [game, host] = gameServer.createGame({nickname: 'neerone', socket});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
		gameServer.forceStartGame({player: host});

		//Подтасовываем карту
		const pl = game.players[host.id];
		each(cards, (card) => {
			pl.getCard(card)
		})

		const randomdiscardCard = host.hand[0];
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardDiscard, cardUniqueId: randomdiscardCard.uniqueId});

		host.hand.splice(0,1, getCard(againstCardId));
		const randomTradeCard = host.hand[0];
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardTrade, cardUniqueId: randomTradeCard.uniqueId});
}


const testDefenseActionCard = ({socket, cards, againstCardId}) => {
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
	gameServer.forceStartGame({player: host});

	//Подтасовываем карту
	const pl = game.players[host.id];
	pl.hand.splice(0,cards.length, ...cards);


	const swapCard = getCard(againstCardId)
	host.hand.splice(0,1, swapCard);
	gameServer.playerAction({player: host, actionType: EPlayerActionType.cardAct, cardUniqueId: swapCard.uniqueId});

	gameServer.playerAction({player: host, actionType: EPlayerActionType.playerSelect, selectedPlayerId: host.id});
};

const testPanic = ({socket, card}: {socket:socketIO.Socket, card: ICardPanic}) => {
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
	gameServer.forceStartGame({player: host});

	game.deck.unshift(card);
	host.getCard(getCard(EEventID.infect));
	host.getCard(getCard(EEventID.infect));
	game.changeTurn(host.id)
}

const interfaceTest = ({socket, card}: {socket:socketIO.Socket, card: ICardEvent}) => {
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});

	gameServer.forceStartGame({player: host});

	host.getCard(getCard(EEventID.tenacity));
	host.getCard(getCard(EEventID.analysis));
}

export function mockGameProcess(socket) {
	setTimeout(() => {
		gameServer.isMock = true;
		gameServer.ignoreChecks = true;

		//testDefenseCard({socket, cards: [
		//	getCard(EEventID.infect),
		//	getCard(EEventID.fear),
		//	getCard(EEventID.noThanks),
		//	getCard(EEventID.miss),
		//], againstCardId: EEventID.barricade});


		//testDefenseActionCard({socket, cards: [
		//	getCard(EEventID.leaveMeAlone),
		//	getCard(EEventID.noFire),
		//], againstCardId: EEventID.flamethrower})


		//testOffenseCard({socket, cards: [
		//	getCard(EEventID.suspicion),
		//	getCard(EEventID.tenacity),
		//	getCard(EEventID.whiskey),
		//	getCard(EEventID.seduction),
		//]})

		//testPanic({socket, card: getPanic(EPanicID.chainReaction)})
		interfaceTest({socket, card: getCard(EEventID.suspicion)})

	}, 500)
}
