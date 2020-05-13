import {gameServer} from 'server/server/GameServer';
import {createDoor, createPlayer} from '_integration/mockSocket';
import {EEventID} from 'shared/enum/cards';
import {getCard} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {Player} from 'server/models/Player';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';
import {each} from 'lodash';
import {ETurnState} from 'shared/enum/player';

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
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		gameServer.connectGame({player: createDoor(), gameId: currentGame.id, nickname:'ДВЕРЬ'});
		gameServer.startGame({player});

		//Подтасовываем карту
		const pl = currentGame.players[player.id];
		pl.hand.splice(0,cards.length, ...cards);
		host.quarantine = 3;
		currentGame.updateGame();
}

const testDefenseCard = ({player, cards, againstCardId}) => {
		const host = createPlayer()
		const currentGame = gameServer.createGame({nickname: 'хост', player: host});
		currentGame.isClockwise = true;
		gameServer.connectGame({player: player, gameId: currentGame.id, nickname:'Вася1'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		gameServer.startGame({player});

		//Подтасовываем карту
		const pl = currentGame.players[player.id];
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
};

const testPanic = ({player, card}: {player:Player, card: ICardPanic}) => {
	const host = player
	const game = gameServer.createGame({nickname: 'хост', player: host});
	const quarantinedPlayer = createPlayer();
	quarantinedPlayer.quarantine =3;
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'1'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'2'});
	gameServer.connectGame({player: quarantinedPlayer, gameId: game.id, nickname:'3'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'4'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'5'});
	gameServer.connectGame({player: createDoor(), gameId: game.id, nickname:'6'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'7'});
	gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'8'});
	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'9'});

	gameServer.startGame({player});

	game.deck.unshift(card);
	game.changeTurn(player.id)
}

const interfaceTest = ({player, card}: {player:Player, card: ICardEvent}) => {
	const host = player
	host.isThing = true;
	const player2 = createPlayer();
	player2.turnState = ETurnState.idle
	const player3 = createPlayer();
	player3.turnState = ETurnState.dead
	const player4 = createPlayer();
	player4.turnState = ETurnState.dead
	const player5 = createPlayer();
	player5.turnState = ETurnState.dead
	const player6 = createPlayer();
	player6.turnState = ETurnState.dead

	const game = gameServer.createGame({nickname: 'хост', player: host});
	gameServer.connectGame({player: player2, gameId: game.id, nickname:'2'});
	gameServer.connectGame({player: player3, gameId: game.id, nickname:'3'});
	gameServer.connectGame({player: createDoor(), gameId: game.id, nickname:'ДВЕРЬ'});
	gameServer.connectGame({player: player4, gameId: game.id, nickname:'4'});
	gameServer.connectGame({player: player5, gameId: game.id, nickname:'5'});
	gameServer.connectGame({player: player6, gameId: game.id, nickname:'6'});


	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'5'});
	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'6'});
	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'7'});
	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'8'});
	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'9'});
	//gameServer.connectGame({player: createPlayer(), gameId: game.id, nickname:'10'});

	each(game.players, pl => pl.isReady = true);
	gameServer.startGame({player});
	setTimeout(() => {
		game.end('Нечто проиграло')
	}, 1000);
	player.getCard(getCard(EEventID.barricade));
	player.getCard(getCard(EEventID.suspicion));
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

		//testPanic({player, card: getPanic(EPanicID.youCallThisParty)})
		interfaceTest({player, card: getCard(EEventID.suspicion)})

	}, 500)
}
