import {GameServer, gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer, createPlayer} from '_integration/mockSocket';
import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';

export const createMockGameServer = (isTestTag = true): [GameServer, Game, ...Player[]] => {
	//const gameServer = new GameServer();
	gameServer.isMock = true;
	// Unit scenarios surgically set up board states (splicing hands/deck), which
	// trips the runtime deck-integrity guard. Tests that care about integrity use
	// checkAllDeckCardsTestEdition explicitly, so disable the runtime guard here.
	gameServer.ignoreChecks = true;
	gameServer.initialize(createMockSocketServer());
	const [game, host] = gameServer.createGame({nickname: 'neerone', socket: createMockSocket(isTestTag)});
	gameServer.connectGame({socket: createMockSocket(isTestTag), gameId: game.id, nickname:'Петя'});
	gameServer.connectGame({socket: createMockSocket(isTestTag), gameId: game.id, nickname:'Гена'});
	gameServer.connectGame({socket: createMockSocket(isTestTag), gameId: game.id, nickname:'Вена'});
	gameServer.connectGame({socket: createMockSocket(isTestTag), gameId: game.id, nickname:'Инна'});
	gameServer.connectGame({socket: createMockSocket(isTestTag), gameId: game.id, nickname:'Гуля'});
	gameServer.forceStartGame({player: host});
	return [gameServer, game, ...map(game.players, (p => p))]
}
