import {Player} from 'server/models/Player';

class MockSocket {
	on(eventType, payload) {
		console.log('')
	}
	emit(eventType, payload) {
		//console.log('EMITED EVENT', eventType);
	}
	join(socketRoom) {
		console.log('MOCKSOCKED JOINED', socketRoom)
	}
}

class MockSocketServer {
	to(roomName) {
		return {
			emit: (eventType, eventPayload) => {
				//console.log('BROADCASTED', eventType, eventPayload)
				console.log('BROADCASTED', eventType)
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
