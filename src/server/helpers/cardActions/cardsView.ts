import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ETurnState} from 'shared/enum/player';
import {formatCards} from 'server/helpers/cardHelpers';
import type {EEventID} from 'shared/enum/cards';
import type {ICardAny} from 'shared/interfaces/cards';
import type INotificationAction from 'shared/interfaces/notification';

// Подсмотр чужих карт — «Анализ» и «Подозрение». Смотрит один, а ждут все,
// поэтому осмотр — это отдельный шаг хода, а не мгновенное событие: пока окно с
// картами открыто, стол показывает от смотрящего к цели стрелку с лупой, и
// только закрытие окна (viewConfirm) пускает ход дальше, к обмену.

export const startCardsView = ({game, player, target, cardId, cards, text}: {
	game: Game,
	player: Player,
	target: Player,
	cardId: EEventID,
	cards: ICardAny[],
	text: string,
}) => {
	const notification: INotificationAction = {
		type: ENotificationAction.okayCard,
		cards: formatCards(cards),
		text,
	};
	game.turnContext = {
		type: ETurnContextType.cardsView,
		offensePlayer: player,
		defensePlayer: target,
		cardId,
	};
	player.changeTurnState(ETurnState.inCardActionProgress);
	player.notify(formatPlayerNotification({player, notification}));
	// Окно с картами — это и есть текущее действие смотрящего. Само по себе
	// уведомление нигде не хранится, а ход теперь ждёт ответа именно на него:
	// так осмотр переживает перезагрузку страницы (клиент открывает окно заново
	// по currentAction) и так его отыгрывает бот.
	player.currentAction = notification;
};

// Игрок закрыл окно с картами. Осмотр окончен: стрелка с лупой уходит со стола,
// и начинается обычный обмен в конце хода.
export const finishCardsView = ({game, player}: {game: Game, player: Player}) => {
	const {turnContext} = game;
	if (!turnContext || turnContext.type !== ETurnContextType.cardsView) return;
	if (turnContext.offensePlayer !== player) return;
	game.turnContext = null;
	player.currentAction = null;
	player.changeTurnState(ETurnState.inOffenseTrade);
};
