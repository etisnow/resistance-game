import {Player} from 'server/models/Player';
import {EPlayerState} from 'shared/enum/player';

class MockSocket {
	on(eventType, payload) {
		console.log('')
	}
	emit(eventType, payload) {
	}
	join(socketRoom) {
	}
}

class MockSocketServer {
	to(roomName) {
		return {
			emit: (eventType, eventPayload) => {
			}
		}
	}
}

export const createPlayer = () => {
	const socket = new MockSocket();
	return new Player({ socket });
}

export const createDoor = () => {
	const socket = new MockSocket();
	const door = new Player({ socket });
	door.state = EPlayerState.door;
	door.nickname = 'ДВЕРЬ';
	return door;
}

export const createMockSocketServer = () => {
	const server = new MockSocketServer();
	return server;
}
