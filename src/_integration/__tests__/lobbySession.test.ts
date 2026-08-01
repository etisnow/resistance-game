import {describe, expect, it, beforeEach} from 'bun:test';
import {gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer, MockSocket} from '_integration/mockSocket';
import {EServerEventType} from 'shared/enum/enumServerEvents';

// Правила сессии игрока в лобби (ник = человек):
//  • одна игра на человека — второй «Создай игру» возвращает в свою же комнату;
//  • вход тем же ником ЗАМЕЩАЕТ старое подключение, а не отбивается ошибкой
//    «игрок ещё онлайн»;
//  • одно место на человека — призрак в чужой комнате уходит вместе с ним.

const errors = (socket: MockSocket): string[] =>
	(socket.spy?.mock.calls ?? [])
		.filter(([type]) => type === EServerEventType.commonError)
		.map(([, payload]) => (payload as {error: string}).error);

describe('Сессия игрока в лобби', () => {
	beforeEach(() => {
		gameServer.isMock = true;
		gameServer.ignoreChecks = true;
		gameServer.initialize(createMockSocketServer());
		gameServer.games = {};
	});

	it('один человек не может создать вторую игру — его возвращает в собственную', () => {
		const first = createMockSocket(true);
		const [gameA, host] = gameServer.createGame({nickname: 'Alice', socket: first});

		// Другое устройство того же человека — снова «Создай игру».
		const second = createMockSocket(true);
		const [gameB, hostAgain] = gameServer.createGame({nickname: 'alice ', socket: second});

		expect(gameB).toBe(gameA);
		expect(hostAgain.id).toBe(host.id);
		expect(Object.keys(gameServer.games)).toEqual([gameA.id]);
		// В комнате по-прежнему один игрок, а не два тёзки.
		expect(Object.keys(gameA.players)).toHaveLength(1);
		// Играет новое подключение, старое отправлено в лаунчер.
		expect(host.socket).toBe(second);
		expect(gameServer.getPlayerBySocket(second)).toBe(host);
		expect(gameServer.getPlayerBySocket(first)).toBeNull();
		expect(errors(first).join(' ')).toContain('вошёл в игру заново');
	});

	it('вход тем же ником замещает старый инстанс игрока, а не отбивается «ещё онлайн»', () => {
		const [game] = gameServer.createGame({nickname: 'Alice', socket: createMockSocket(true)});
		const bobFirst = createMockSocket(true);
		const bob = gameServer.connectGame({nickname: 'Bob', socket: bobFirst, gameId: game.id});
		expect(bob).not.toBeNull();

		// Старый сокет жив (disconnected === false) — раньше это блокировало вход.
		const bobSecond = createMockSocket(true);
		const bobAgain = gameServer.connectGame({nickname: 'Bob', socket: bobSecond, gameId: game.id});

		expect(bobAgain).not.toBeNull();
		expect(bobAgain!.id).toBe(bob!.id);
		expect(bobAgain!.isConnected).toBe(true);
		expect(bobAgain!.socket).toBe(bobSecond);
		expect(Object.keys(game.players)).toHaveLength(2);
		// Старое подключение больше не считается этим игроком: его отложенный
		// disconnect не должен пометить вернувшегося офлайн.
		expect(gameServer.getPlayerBySocket(bobFirst)).toBeNull();
	});

	it('человек занимает одно место: войдя в чужую комнату, он забирает свою с собой', () => {
		const [gameA] = gameServer.createGame({nickname: 'Alice', socket: createMockSocket(true)});
		const [gameB] = gameServer.createGame({nickname: 'Bob', socket: createMockSocket(true)});

		gameServer.connectGame({nickname: 'Alice', socket: createMockSocket(true), gameId: gameB.id});

		expect(Object.keys(gameServer.games)).toEqual([gameB.id]);
		expect(gameA.gameInProcess).toBe(false);
		expect(Object.values(gameB.players).map((p) => p.nickname).sort()).toEqual(['Alice', 'Bob']);
	});

	it('исключить можно и отключившегося игрока', () => {
		const [game] = gameServer.createGame({nickname: 'Alice', socket: createMockSocket(true)});
		const bob = gameServer.connectGame({nickname: 'Bob', socket: createMockSocket(true), gameId: game.id});
		bob!.makeOffline();

		gameServer.kickPlayer({playerId: bob!.id});

		expect(Object.values(game.players).map((p) => p.nickname)).toEqual(['Alice']);
	});
});
