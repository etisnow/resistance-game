import {ETurnContextType} from 'shared/enum/turnContextType';
import { ICardAny, ICardEvent} from 'shared/interfaces/cards';
import {Player} from 'server/models/Player';
import {EEventID} from 'shared/enum/cards';

export interface ITurnContextTrade {
	type: ETurnContextType.trade,
	offensePlayer: Player,
	defensePlayer: Player | null,
	offenseCardId: EEventID | null,
}

export interface ITurnContextPositionSwap {
	type: ETurnContextType.positionswap,
	offensePlayer: Player,
	defensePlayer: Player | null,
}

export interface ITurnContextTenacityCardSelect {
	type: ETurnContextType.tenacityCardSelect,
	playerId: Player['id'],
	cards: [ICardEvent, ICardEvent, ICardEvent],
}

export interface ITurnContextSuspicionPersonSelect {
	type: ETurnContextType.suspicionPersonSelect,
	playerId: Player['id']
}



export interface ITurnContextFlameThrowerSelect {
	type: ETurnContextType.flamethrowerSelect,
	playerId: Player['id']
}

export interface ITurnContextReelFishingRodsSelect {
	type: ETurnContextType.reelFishingRodsPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextBarricadeSelect {
	type: ETurnContextType.barricadePersonSelect,
	playerId: Player['id']
}

export interface ITurnContextSeductionSelect {
	type: ETurnContextType.seduction,
	playerId: Player['id'],
	playerIdToTrade: Player['id'] | null,
}

export interface ITurnContextQuarantineSelect {
	type: ETurnContextType.quarantinePersonSelect,
	playerId: Player['id'],
}
export interface ITurnContextAxeSelect {
	type: ETurnContextType.axePersonSelect,
	playerId: Player['id'],
}

export interface ITurnContextAnalysisSelect {
	type: ETurnContextType.analysisPersonSelect,
	playerId: Player['id'],
}


export type ITurnContext =
	ITurnContextTrade
	| ITurnContextPositionSwap
	| ITurnContextTenacityCardSelect
	| ITurnContextSuspicionPersonSelect
	| ITurnContextFlameThrowerSelect
	| ITurnContextBarricadeSelect
	| ITurnContextSeductionSelect
	| ITurnContextQuarantineSelect
	| ITurnContextAxeSelect
	| ITurnContextAnalysisSelect;
