import {gameServer} from 'server/server/GameServer';
import {createPlayer} from 'server/_playground/mockSocket';


export function mockGameProcess(player) {
	setTimeout(() => {
		gameServer.isMock = true;

		const currentGame = gameServer.createGame({nickname: 'neerone', player: player});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Вася1'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Петя2'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Генадий Игрогрив3'});
		gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Виталий4'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Ветрокрыл6'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'Ветрокрыл7'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'MT8'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'MT9'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'MT10'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'MT11'});
		//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname:'MT11'});

		gameServer.startGame({player});

		//setInterval(() => {
		//	//gameServer.connectGame({player: createPlayer(), gameId: currentGame.id, nickname: Math.random()+''});
		//	gameServer.startGame({player});
		//}, 2000)
	}, 500)
}
