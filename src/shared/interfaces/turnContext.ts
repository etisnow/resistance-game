import {ETurnContextType} from 'shared/enum/turnContextType';
import type { ICardEvent} from 'shared/interfaces/cards';
import type { EEventID } from 'shared/enum/cards';
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
	// Местами меняют две разные карты («Смена мест» и «Сматывай удочки»), и на
	// стрелке клиент показывает именно ту, которой ходят.
	cardId: EEventID,
}

export interface ITurnContextBurn {
	type: ETurnContextType.burn,
	offensePlayer: Player,
	defensePlayer: Player | null,
	cardUniqueId: string;
	cardId: EEventID,
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

// Подсмотр чужих карт («Анализ» и «Подозрение»): пока смотрящий не закроет окно
// с картами, ход стоит, а стол показывает от него к цели стрелку с лупой.
// cardId — карта, которой смотрят: с неё стрелка берёт цвет.
export interface ITurnContextCardsView {
	type: ETurnContextType.cardsView,
	offensePlayer: Player,
	defensePlayer: Player,
	cardId: EEventID,
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
	| ITurnContextCardsView
	/*PANICS*/
	| ITurnContextFriendshipSeduction
	| ITurnContextBlindDateCardSelect
	| ITurnContextChainReaction
	| ITurnContextOneTwoPersonSelect
	| ITurnContextOnlyBetweenUsPersonSelect
	| ITurnContextForgetfullnessCardSelect;
