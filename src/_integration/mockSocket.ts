import {Player} from 'server/models/Player';
import {EPlayerState} from 'shared/enum/player';
import type {Mock} from 'bun:test';
import type {IGameSocket, ISocketServer} from 'shared/interfaces/socket';

type SpyFn = Mock<(eventType: string, payload?: unknown) => void>;

export class MockSocket implements IGameSocket {
	spy?: SpyFn;
	isTest: boolean;
	readonly disconnected = false;

	constructor(isTestTag: boolean) {
		this.isTest = isTestTag;
		if (isTestTag) {
			this.spy = jest.fn();
		}
	}
	on(_eventType: string, _listener: (...args: unknown[]) => void): void {
	}
	emit(eventType: string, payload?: unknown): void {
		if (this.isTest && this.spy) {
			this.spy(eventType, payload)
		}
	}
	join(_room: string): void {
	}
}

export class MockSocketServer implements ISocketServer {
	to(_roomName: string) {
		return {
			emit: (_eventType: string, _eventPayload?: unknown) => {
			}
		}
	}
}

export const createPlayer = (isTestTag = false): Player => {
	const socket = new MockSocket(isTestTag);
	const pl = new Player({ socket });
	pl.isReady = true;
	return pl;
}

export const createMockSocket = (isTestTag = false): MockSocket => {
	return new MockSocket(isTestTag);
}

export const createDoor = (isTestTag = false): Player => {
	const socket = new MockSocket(isTestTag);
	const door = new Player({ socket });
	door.state = EPlayerState.door;
	door.nickname = 'ДВЕРЬ';
	return door;
}

export const createMockSocketServer = (): MockSocketServer => {
	return new MockSocketServer();
}

// Notifications captured by a test player's mock socket: [eventType, payload].
export const getSpyCalls = (player: Player): [string, unknown][] => {
	const socket = player.socket;
	if (socket instanceof MockSocket && socket.spy) {
		return socket.spy.mock.calls as [string, unknown][];
	}
	return [];
};
