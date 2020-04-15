export enum EPlayerState {
	dummy = 'dummy',
	registered = 'registered',
	door = 'door',
}

export enum ETurnState {
	idle = 'idle',
	inCardAction = 'inCardAction',
	inOffenseTrade = 'inOffenseTrade',
	inDefenseTrade = 'inDefenseTrade',
	inOffenseSwap = 'inOffenseSwap',
	inDefenceSwap = 'inDefenceSwap',
	inCardActionProgress = 'inCardActionProgress',
}
