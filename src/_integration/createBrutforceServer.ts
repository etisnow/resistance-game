import {GameServer, gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer} from '_integration/mockSocket';
import {map} from 'lodash';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {EAnalyticsSource} from 'shared/analytics/contract';

// Ботов сажаем за стол по порядку из этого списка: первый — создатель комнаты.
const BOT_NICKNAMES = ['neerone', 'Петя', 'Гена', 'Вена', 'Инна', 'Гуля', 'Саша', 'Гиря', 'Пиво', 'Диво', 'Вася'];

export const createBrutforceServer = (playersCount = BOT_NICKNAMES.length): [GameServer, Game, ...Player[]] => {
	if (playersCount < 2 || playersCount > BOT_NICKNAMES.length) {
		throw new Error(`Фаззер умеет собирать стол на 2..${BOT_NICKNAMES.length} игроков, запрошено ${playersCount}`);
	}
	// Real-game mode with deck-integrity checks ENABLED so the fuzzer surfaces
	// any inconsistency (no ignoreChecks shortcut).
	gameServer.isMock = false;
	gameServer.ignoreChecks = false;
	// Фаззер играет в реальном режиме, но это не живые партии: помечаем их
	// тестовыми, иначе тысячи синтетических игр уедут в аналитический центр.
	gameServer.analyticsSource = EAnalyticsSource.test;
	gameServer.initialize(createMockSocketServer());
	// Комнаты предыдущих прогонов не должны переезжать в новый: одна игра на
	// человека — повторный createGame иначе вернул бы старую комнату.
	gameServer.games = {};
	const [game, player1] = gameServer.createGame({nickname: BOT_NICKNAMES[0]!, socket: createMockSocket()});
	for (const nickname of BOT_NICKNAMES.slice(1, playersCount)) {
		gameServer.connectGame({socket: createMockSocket(), gameId: game.id, nickname});
	}

	gameServer.forceStartGame({player: player1});
	return [gameServer, game, ...map(game.players, (p => p))]
}
