import {gameServer} from 'server/server/GameServer';
import {createDoor, createPlayer} from 'server/_playground/mockSocket';
import {EEventID} from 'shared/enum/cards';
import {getCard} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';

const testOffenseCard = ({player, cards}) => {
		const host = player
		const currentGame = gameServer.createGame({nickname: 'хост', player: host});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Вася1'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		gameServer.startGame({player});
		//Подтасовываем карту
		const pl = currentGame.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);
		currentGame.updateGame();
}

const testAxeCard = ({player, cards}) => {
		const host: Player = player;
		const currentGame = gameServer.createGame({nickname: 'хост', player: host});
		//gameServer.connectGame({player: createDoor(), gameId: currentGame.id, nickname:'ДВЕРЬ'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		gameServer.startGame({player});

		//Подтасовываем карту
		const pl = currentGame.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);
		//host.quarantine = 3;
		currentGame.updateGame();
}

const testDefenseCard = ({player, cards, againstCardId}) => {
		const host = createPlayer()
		const currentGame = gameServer.createGame({nickname: 'хост', player: host});
		gameServer.connectGame({player: player, gameId: currentGame.id, nickname:'Вася1'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		gameServer.startGame({player});

		//Подтасовываем карту
		const pl = currentGame.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);


		const randomdiscardCard = host.hand[0];
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardDiscard, cardUniqueId: randomdiscardCard.uniqueId});

		host.hand.splice(0,1, getCard(againstCardId));
		const randomTradeCard = host.hand[0];
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardTrade, cardUniqueId: randomTradeCard.uniqueId});
}




const testDefenseActionCard = ({player, cards, againstCardId}) => {
		const host = createPlayer()
		const currentGame = gameServer.createGame({nickname: 'хост', player: host});
		gameServer.connectGame({player: player, gameId: currentGame.id, nickname:'Вася1'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		gameServer.startGame({player});

		//Подтасовываем карту
		const pl = currentGame.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);


		const swapCard = getCard(againstCardId)
		host.hand.splice(0,1, swapCard);
		gameServer.playerAction({player: host, actionType: EPlayerActionType.cardAct, cardUniqueId: swapCard.uniqueId});


		gameServer.playerAction({player: host, actionType: EPlayerActionType.playerSelect, selectedPlayerId: player.id});



		//const randomTradeCard = host.hand[0];
		//gameServer.playerAction({player: host, actionType: EPlayerActionType.cardTrade, cardUniqueId: randomTradeCard.uniqueId});
};

export function mockGameProcess(player) {
	setTimeout(() => {
		gameServer.isMock = true;

		//testDefenseCard({player, cards: [
		//	getCard(EEventID.fear),
		//	getCard(EEventID.noThanks),
		//	getCard(EEventID.miss),
		//], againstCardId: EEventID.barricade})


		//testDefenseActionCard({player, cards: [
		//	getCard(EEventID.leaveMeAlone),
		//	getCard(EEventID.noFire),
		//], againstCardId: EEventID.flamethrower})


		testOffenseCard({player, cards: [
			getCard(EEventID.positionswap),
			getCard(EEventID.injure),
			getCard(EEventID.quarantine),
			getCard(EEventID.noFire),
		]})

		//testAxeCard({player, cards: [
		//	getCard(EEventID.axe),
		//	getCard(EEventID.barricade),
		//]})

	}, 500)
}
