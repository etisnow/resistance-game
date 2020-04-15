import {ECardType, EEventType} from 'shared/enum/cards';


export interface ICard {
	type: ECardType,
	id: string,
	description: string,
	eventType? : EEventType
	uniqueId?: string | null;
	playersCount?: number[];
}
