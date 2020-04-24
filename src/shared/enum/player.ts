export enum EPlayerState {
	dummy = 'dummy',
	registered = 'registered',
	door = 'door',
}

export enum ETurnState {
	idle = 'idle',
	inCardAction = 'inCardAction',
	inCardActionProgress = 'inCardActionProgress',

	inOffenseTrade = 'inOffenseTrade',
	inDefenseTrade = 'inDefenseTrade',
	dead = 'dead',
}
