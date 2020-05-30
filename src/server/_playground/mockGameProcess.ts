import {gameServer} from 'server/server/GameServer';
import {createPlayer} from 'server/_playground/mockSocket';


export function mockGameProcess(socket) {
	setTimeout(() => {
		gameServer.isMock = true;

		const [game,host] = gameServer.createGame({nickname: 'neerone', socket});
		gameServer.connectGame({socket, gameId: game.id, nickname:'Вася1'});
		gameServer.connectGame({socket, gameId: game.id, nickname:'Петя2'});
		gameServer.connectGame({socket, gameId: game.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({socket, gameId: game.id, nickname:'Виталий4'});

		gameServer.startGame({player: host});

		//setInterval(() => {
		//	//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname: Math.random()+''});
		//	gameServer.startGame({player});
		//}, 2000)
	}, 500)
}
