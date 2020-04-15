import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICard} from 'shared/interfaces/cards';
import {Player} from 'server/models/Player';


export interface ITurnContextYporstvoCardSelect {
	type: ETurnContextType.tenacityCardSelect,
	playerId: Player['id'],
	cards: [ICard, ICard, ICard],
}

export interface ITurnContextPodozreniePersonSelect {
	type: ETurnContextType.suspicionPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextMenuaemsyaMestamiPersonSelect {
	type: ETurnContextType.positionswapPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextOgnemetSelect {
	type: ETurnContextType.flamethrowerSelect,
	playerId: Player['id']
}

export interface ITurnContextSmatyvayUdochkiSelect {
	type: ETurnContextType.smatyvayUdochkiPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextZakolochennayaDverSelect {
	type: ETurnContextType.zakolochennayaDverPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextZakolochennayaSoblaznSelect {
	type: ETurnContextType.seduction,
	playerId: Player['id'],
	playerIdToTrade: Player['id'] | null,
}

export interface ITurnContextKarantinSelect {
	type: ETurnContextType.quarantinePersonSelect,
	playerId: Player['id'],
}
export interface ITurnContextToporSelect {
	type: ETurnContextType.axePersonSelect,
	playerId: Player['id'],
}

export interface ITurnContextAnalizSelect {
	type: ETurnContextType.analysisPersonSelect,
	playerId: Player['id'],
}
export type ITurnContext =
	ITurnContextYporstvoCardSelect
	| ITurnContextPodozreniePersonSelect
	| ITurnContextMenuaemsyaMestamiPersonSelect
	| ITurnContextOgnemetSelect
	| ITurnContextSmatyvayUdochkiSelect
	| ITurnContextZakolochennayaDverSelect
	| ITurnContextZakolochennayaSoblaznSelect
	| ITurnContextKarantinSelect
	| ITurnContextToporSelect
	| ITurnContextAnalizSelect;
