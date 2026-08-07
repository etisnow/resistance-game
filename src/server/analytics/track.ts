import {EAnalyticsMark, EAnalyticsSource} from 'shared/analytics/contract';
import {analyticsSink} from 'server/analytics/sink';
import {EPlayerMark} from 'shared/enum/playerMarks';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {EEventID, EPanicID} from 'shared/enum/cards';
import type {Game} from 'server/models/Game';

/**
 * Отдать законченную партию в аналитику. Вызывается ровно из двух мест: конец
 * партии (`Game.end`) и закрытие комнаты недоигранной (`GameServer.destroyGame`).
 * Повторный вызов безвреден — рекордер отдаёт пакет только один раз.
 */
export const submitMatch = (game: Game, {endMessage, isComplete}: {endMessage: string; isComplete: boolean}) => {
	try {
		const match = game.analytics.finish({game, endMessage, isComplete});
		if (!match) return;
		// Тесты не отправляем вовсе: фаззер гоняет тысячи партий за прогон, а e2e
		// играет заведомо искусственные сценарии. Их в базе делать нечего — и
		// стучаться в аналитику из тестового прогона тоже незачем.
		if (match.source === EAnalyticsSource.test || match.source === EAnalyticsSource.e2e) return;
		analyticsSink.submit(match);
	} catch (e) {
		console.error('[analytics] не удалось отправить партию:', e);
	}
};

/** Статус движка -> статус контракта (значения совпадают, но связь явная). */
export const toAnalyticsMark = (mark: EPlayerMark | undefined): EAnalyticsMark | null => {
	switch (mark) {
		case EPlayerMark.clear:
			return EAnalyticsMark.clear;
		case EPlayerMark.question:
			return EAnalyticsMark.question;
		case EPlayerMark.infected:
			return EAnalyticsMark.infected;
		case EPlayerMark.thing:
			return EAnalyticsMark.thing;
		case EPlayerMark.none:
			return EAnalyticsMark.none;
		default:
			return null;
	}
};

/**
 * Какой картой играют, когда стол ждёт выбора игрока. Нужно, чтобы у выбора цели
 * была та же карта, что и у её розыгрыша: тогда «сыграл анализ на X» — одно
 * событие, а не два.
 */
export const contextCardId = (type: ETurnContextType): string | null => {
	switch (type) {
		case ETurnContextType.suspicionPersonSelect:
			return EEventID.suspicion;
		case ETurnContextType.positionswap:
			return EEventID.positionswap;
		case ETurnContextType.burn:
			return EEventID.flamethrower;
		case ETurnContextType.barricadePersonSelect:
			return EEventID.barricade;
		case ETurnContextType.seduction:
			return EEventID.seduction;
		case ETurnContextType.quarantinePersonSelect:
			return EEventID.quarantine;
		case ETurnContextType.axePersonSelect:
			return EEventID.axe;
		case ETurnContextType.analysisPersonSelect:
			return EEventID.analysis;
		// Паники: карту выбирает не игрок, но цель всё равно его решение.
		case ETurnContextType.friendshipSeduction:
			return EPanicID.friendship;
		case ETurnContextType.oneTwoPersonSelect:
			return EPanicID.oneTwo;
		case ETurnContextType.onlyBetweenUsPersonSelect:
			return EPanicID.onlyBetweenUs;
		default:
			return null;
	}
};

/** Карта, к которой относится решение в диалоге (сгореть/шашлык/меняться). */
export const decisionCardId = (action: string): string | null => {
	switch (action) {
		case 'burn':
			return EEventID.flamethrower;
		case 'noFire':
			return EEventID.noFire;
		case 'swap':
		case 'cancelSwap':
			return EEventID.positionswap;
		default:
			return null;
	}
};
