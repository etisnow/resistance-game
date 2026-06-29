import {ETurnContextType} from 'shared/enum/turnContextType';
import type { ICardEvent} from 'shared/interfaces/cards';
import {Player} from 'server/models/Player';

export interface ITurnContextTrade {
	type: ETurnContextType.trade,
	offensePlayer: Player,
	defensePlayer: Player | null,
	offenseCard: ICardEvent | null,
	defenseCard: ICardEvent | null,
}

export interface ITurnContextPositionSwap {
	type: ETurnContextType.positionswap,
	offensePlayer: Player,
	defensePlayer: Player | null,
	cardUniqueId: string,
}

export interface ITurnContextBurn {
	type: ETurnContextType.burn,
	offensePlayer: Player,
	defensePlayer: Player | null,
	cardUniqueId: string;
}

export interface ITurnContextSeduction {
	type: ETurnContextType.seduction,
	offensePlayer: Player,
	defensePlayer: Player | null,
	cardUniqueId: string,
}

export interface ITurnContextTenacityCardSelect {
	type: ETurnContextType.tenacityCardSelect,
	playerId: Player['id'],
	cards: [ICardEvent, ICardEvent, ICardEvent],
}

export interface ITurnContextSuspicionPersonSelect {
	type: ETurnContextType.suspicionPersonSelect,
	playerId: Player['id'],
	cardUniqueId: string,
}



export interface ITurnContextBarricadeSelect {
	type: ETurnContextType.barricadePersonSelect,
	playerId: Player['id'],
	cardUniqueId: string,
}

export interface ITurnContextQuarantineSelect {
	type: ETurnContextType.quarantinePersonSelect,
	playerId: Player['id'],
	cardUniqueId: string,
}
export interface ITurnContextAxeSelect {
	type: ETurnContextType.axePersonSelect,
	playerId: Player['id'],
	cardUniqueId: string,
}

export interface ITurnContextAnalysisSelect {
	type: ETurnContextType.analysisPersonSelect,
	playerId: Player['id'],
	cardUniqueId: string,
}



/* PANICS */
export interface ITurnContextChainReaction {
	type: ETurnContextType.chainReaction,
	playersPick: {player: Player, card: ICardEvent}[],
	startPlayer: Player,
}

export interface ITurnContextBlindDateCardSelect {
	type: ETurnContextType.blindDateCardSelect,
	playerId: Player['id']
}

export interface ITurnContextOneTwoPersonSelect {
	type: ETurnContextType.oneTwoPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextOnlyBetweenUsPersonSelect {
	type: ETurnContextType.onlyBetweenUsPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextForgetfullnessCardSelect {
	type: ETurnContextType.forgetfullnessSelect,
	playerId: Player['id'],
	cards: string[],
}

export interface ITurnContextFriendshipSeduction {
	type: ETurnContextType.friendshipSeduction,
	offensePlayer: Player,
	defensePlayer: Player | null,
}

export type ITurnContext =
	ITurnContextTrade
	| ITurnContextPositionSwap
	| ITurnContextBurn
	| ITurnContextTenacityCardSelect
	| ITurnContextSuspicionPersonSelect
	| ITurnContextBarricadeSelect
	| ITurnContextSeduction
	| ITurnContextQuarantineSelect
	| ITurnContextAxeSelect
	| ITurnContextAnalysisSelect
	/*PANICS*/
	| ITurnContextFriendshipSeduction
	| ITurnContextBlindDateCardSelect
	| ITurnContextChainReaction
	| ITurnContextOneTwoPersonSelect
	| ITurnContextOnlyBetweenUsPersonSelect
	| ITurnContextForgetfullnessCardSelect;
