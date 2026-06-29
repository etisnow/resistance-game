// Minimal socket surface used by the game engine. Both the real socket.io
// Socket and the test MockSocket structurally satisfy this, so the engine
// never depends on `any`.
export interface IGameSocket {
	emit(event: string, payload?: unknown): void;
	on(event: string, listener: (...args: unknown[]) => void): void;
	join(room: string): void;
	readonly disconnected?: boolean;
	readonly id?: string;
}

// Server → client event envelope produced by the formatters.
export interface IServerEvent<TPayload = unknown> {
	type: string;
	payload?: TPayload;
}

// Minimal socket.io-server surface (room broadcast). Both the real socket.io
// Server and the test MockSocketServer satisfy it.
export interface ISocketServer {
	to(room: string): { emit(event: string, payload?: unknown): void };
}
