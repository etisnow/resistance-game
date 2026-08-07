import {EAnalyticsMark} from 'shared/analytics/contract';

/**
 * Был ли статус правдой.
 *
 * Считаем по тому, кем цель была В МОМЕНТ ПРОСТАНОВКИ, а не в конце партии:
 * игрок, пометивший соседа «чист» до того, как тот заразился, был прав — и
 * задним числом обвинять его нечестно.
 *
 * Правила:
 *  - «Нечто» — верно только про самого Нечто (это сильное заявление);
 *  - «заражён» — верно про любого заражённого, включая Нечто (Нечто заражено
 *    по определению, так что попадание засчитываем);
 *  - «чист» — верно про незаражённого;
 *  - «?» и снятие статуса мнением не считаются и в точность не идут (null).
 */
export const scoreMark = ({
	mark,
	targetWasThing,
	targetWasInfected,
}: {
	mark: string;
	targetWasThing: boolean;
	targetWasInfected: boolean;
}): boolean | null => {
	switch (mark) {
		case EAnalyticsMark.thing:
			return targetWasThing;
		case EAnalyticsMark.infected:
			return targetWasInfected;
		case EAnalyticsMark.clear:
			return !targetWasInfected;
		case EAnalyticsMark.question:
		case EAnalyticsMark.none:
			return null;
		default:
			return null;
	}
};

/** Статусы, которые считаются обвинением (по ним меряем «паранойю»). */
export const isAccusation = (mark: string): boolean =>
	mark === EAnalyticsMark.thing || mark === EAnalyticsMark.infected;
