import {Player} from 'server/models/Player';

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

export const createMockSocketServer = () => {
	const server = new MockSocketServer();
	return server;
}
