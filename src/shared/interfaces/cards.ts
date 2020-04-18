import {ECardType, EEventID, EEventType, EPanicID} from 'shared/enum/cards';

interface ICardEventCommon {
	description: string,
	eventType? : EEventType
	uniqueId?: string | null;
	playersCount?: number[];
}

export interface ICardPanic extends ICardEventCommon {
	type: ECardType.panic,
	id: EPanicID,
}

export interface ICardEvent extends ICardEventCommon {
	type: ECardType.event,
	id: EEventID,
}

export type ICardAny = ICardPanic | ICardEvent;
//export type ICardEvent = ICardEventCommon & ICardEventEvent & ICardEventPanic;
