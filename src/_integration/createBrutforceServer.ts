import {GameServer, gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer} from '_integration/mockSocket';
import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';

export const createBrutforceServer = (): [GameServer, Game, ...Player[]] => {
	// Real-game mode with deck-integrity checks ENABLED so the fuzzer surfaces
	// any inconsistency (no ignoreChecks shortcut).
	gameServer.isMock = false;
	gameServer.ignoreChecks = false;
	gameServer.initialize(createMockSocketServer());
	// Комнаты предыдущих прогонов не должны переезжать в новый: одна игра на
	// человека — повторный createGame иначе вернул бы старую комнату.
	gameServer.games = {};
	const [game, player1] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket()});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гуля'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Саша'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Гиря'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Пиво'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Диво'});
	gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname:'Вася'});

	gameServer.forceStartGame({player: player1});
	return [gameServer, game, ...map(game.players, (p => p))]
}
