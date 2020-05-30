import {GameServer, gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer, createPlayer} from '_integration/mockSocket';
import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';

export const createMockGameServer = (isTestTag = true): [GameServer, Game, ...Player[]] => {
	//const gameServer = new GameServer();
	gameServer.isMock = true;
	gameServer.initialize(createMockSocketServer());
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
	gameServer.startGame({player: host});
	return [gameServer, game, ...map(game.players, (p => p))]
}
