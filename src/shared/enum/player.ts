export enum EPlayerState {
	dummy = 'dummy',
	registered = 'registered',
	door = 'door',
}

// В «Сопротивлении» игрок либо чего-то ждёт, либо от него ждут ответа. Никто не
// выбывает, поэтому «мёртвых» состояний тут нет.
export enum ETurnState {
	idle = 'idle',
	waiting = 'waiting',
}
