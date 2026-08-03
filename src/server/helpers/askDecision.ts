import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';

type TDecisionMenu = {text: string, action: string}[];

/**
 * Спрашиваем у игрока решение. Если вариант всего один (сгореть, поменяться
 * местами), выбирать нечего — возвращаем его, и вызывающий доигрывает ход сам,
 * не заставляя игрока тыкать единственную кнопку. Иначе шлём меню и ждём ответа.
 */
export const askDecision = ({asker, decider, text, menu}: {
	asker: Player,
	decider: Player,
	text: string,
	menu: TDecisionMenu,
}): string | null => {
	const onlyOption = menu.length === 1 ? menu[0] : undefined;
	if (onlyOption) return onlyOption.action;

	decider.notify(formatPlayerNotification({
		player: asker,
		notification: {
			type: ENotificationAction.actionDecision,
			text,
			menu,
		},
	}));
	return null;
};
