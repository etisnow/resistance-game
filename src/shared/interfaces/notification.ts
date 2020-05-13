import {ENotificationAction} from 'shared/enum/notifications';
import {ICardEvent, ICardPanic} from 'shared/interfaces/cards';

interface INotificationActionCommon {
	text: string;
}

interface INotificationActionInfo {
	type: ENotificationAction.info
}
interface INotificationActionGameEnd {
	type: ENotificationAction.gameEnd
	menu : {text: string, action: string}[]
}
export interface INotificationActionDecision {
	type: ENotificationAction.actionDecision,
	menu : {text: string, action: string}[]
}
export interface INotificationActionOkayCard {
	type: ENotificationAction.okayCard,
	cards: {[key:string]: ICardEvent | ICardPanic};
}
export interface INotificationActionSelectCard {
	type: ENotificationAction.selectCard,
	cards: {[key:string]: ICardEvent | ICardPanic};
}
export interface INotificationActionPlayerSelect {
	type: ENotificationAction.playerSelect,
	playersToSelect: string[],
}

export interface INotificationActionDefenseTradeCard {
	type: ENotificationAction.defenseTradeCard
}

export interface INotificationActionOffenseTradeCard {
	type: ENotificationAction.offenseTradeCard
}

export interface INotificationActionTurnCard {
	type: ENotificationAction.turnCard
}
export interface INotificationActionCardPick {
	type: ENotificationAction.cardPick
}
type INotificationAction = INotificationActionCommon &
	(
		INotificationActionCardPick
		| INotificationActionDecision
		| INotificationActionInfo
		| INotificationActionOkayCard
		| INotificationActionSelectCard
		| INotificationActionPlayerSelect
		| INotificationActionDefenseTradeCard
		| INotificationActionOffenseTradeCard
		| INotificationActionTurnCard
		| INotificationActionGameEnd
	);

export default INotificationAction;
