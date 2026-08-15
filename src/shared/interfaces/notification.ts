import {ENotificationAction} from 'shared/enum/notifications';

interface INotificationActionCommon {
	text: string;
}

interface INotificationActionInfo {
	type: ENotificationAction.info
}

interface INotificationActionGameEnd {
	type: ENotificationAction.gameEnd
	menu: {text: string, action: string}[]
	// Чей верх. Отдельным полем, а не по тексту сообщения: текст — фраза для
	// игрока, и переписать её должно быть можно, не сломав ничего, что от исхода
	// зависит (сейчас — звук развязки).
	isSpiesWin: boolean
}

export interface INotificationActionDecision {
	type: ENotificationAction.actionDecision,
	menu: {text: string, action: string}[]
	// Сколько секунд отведено на ответ и что сервер нажмёт сам, когда они выйдут.
	// Клиент отсчитывает это на кнопке по умолчанию (см. server/helpers/askDecision).
	seconds?: number,
	defaultAction?: string,
}

export interface INotificationActionPlayerSelect {
	type: ENotificationAction.playerSelect,
	playersToSelect: string[],
}

type INotificationAction = INotificationActionCommon &
	(
		INotificationActionDecision
		| INotificationActionInfo
		| INotificationActionPlayerSelect
		| INotificationActionGameEnd
	);

export default INotificationAction;
