import {ENotificationAction} from 'shared/enum/notifications';
import type {ICardEvent, ICardPanic} from 'shared/interfaces/cards';

interface INotificationActionCommon {
	text: string;
}

interface INotificationActionInfo {
	type: ENotificationAction.info
}
interface INotificationActionGameEnd {
	type: ENotificationAction.gameEnd
	menu : {text: string, action: string}[]
	// Чей верх. Отдельным полем, а не по тексту сообщения: текст — фраза для
	// игрока, и переписать её должно быть можно, не сломав ничего, что от исхода
	// зависит (сейчас — звук развязки, см. releaseGameEnd).
	isThingWin: boolean
}
export interface INotificationActionDecision {
	type: ENotificationAction.actionDecision,
	menu : {text: string, action: string}[]
	// Сколько секунд отведено на ответ и что сервер нажмёт сам, когда они выйдут.
	// Клиент отсчитывает это на кнопке по умолчанию (см. server/helpers/askDecision).
	seconds?: number,
	defaultAction?: string,
}
export interface INotificationActionOkayCard {
	type: ENotificationAction.okayCard,
	cards: {[key:string]: ICardEvent | ICardPanic};
}
// Одно окно на весь выбор: игрок отмечает галочками ровно count карт из cards и
// подтверждает их разом (см. клиентский Notifier и EPlayerActionType.cardsSelect).
export interface INotificationActionSelectCards {
	type: ENotificationAction.selectCards,
	cards: {[key:string]: ICardEvent | ICardPanic};
	count: number;
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
		| INotificationActionSelectCards
		| INotificationActionPlayerSelect
		| INotificationActionDefenseTradeCard
		| INotificationActionOffenseTradeCard
		| INotificationActionTurnCard
		| INotificationActionGameEnd
	);

export default INotificationAction;
