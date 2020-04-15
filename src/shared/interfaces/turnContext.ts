import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICard} from 'shared/interfaces/cards';
import {Player} from 'server/models/Player';


export interface ITurnContextYporstvoCardSelect {
	type: ETurnContextType.yporstvoCardSelect,
	playerId: Player['id'],
	cards: [ICard, ICard, ICard],
}

export interface ITurnContextPodozreniePersonSelect {
	type: ETurnContextType.podozreniePersonSelect,
	playerId: Player['id']
}

export interface ITurnContextMenuaemsyaMestamiPersonSelect {
	type: ETurnContextType.menyaemsyaMestamiPersonSelect,
	playerId: Player['id']
}

export interface ITurnContextOgnemetSelect {
	type: ETurnContextType.ognemetSelect,
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
	type: ETurnContextType.soblazn,
	playerId: Player['id'],
	playerIdToTrade: Player['id'] | null,
}

export interface ITurnContextKarantinSelect {
	type: ETurnContextType.karantinPersonSelect,
	playerId: Player['id'],
}
export interface ITurnContextToporSelect {
	type: ETurnContextType.toporPersonSelect,
	playerId: Player['id'],
}

export interface ITurnContextAnalizSelect {
	type: ETurnContextType.analizPersonSelect,
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
