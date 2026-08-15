import {EGamePhase} from 'shared/enum/phase';

/**
 * Всё состояние партии «Сопротивления» — один объект (живёт как `game.round`).
 * Никакой колоды, руки и очереди отложенных эффектов: фаза раунда однозначно
 * определяет, чего сервер ждёт и от кого.
 */
export interface IResistanceState {
	phase: EGamePhase;
	/** Номер текущей миссии, 0..4. */
	missionIndex: number;
	/** Исходы миссий: true — успех, false — провал, null — ещё не сыграна. */
	missionResults: (boolean | null)[];
	leaderId: string;
	/** Отклонений подряд в этом раунде: на MAX_REJECTS партия уходит шпионам. */
	rejectCount: number;
	/** Состав команды, который лидер набирает прямо сейчас. */
	team: string[];
	/** Голоса за состав. Наружу уходят только после вскрытия — см. FR-5. */
	votes: Record<string, boolean>;
	/**
	 * Вскрытые голоса последнего голосования. Живут до конца следующего набора
	 * команды: стол должен успеть их показать, а в «Сопротивлении» они и так
	 * открытые — по ним и играют.
	 */
	revealedVotes: Record<string, boolean> | null;
	/** Карты миссии: true — «Успех». Наружу уходит только число провалов (FR-9). */
	missionCards: Record<string, boolean>;
	/** Сколько провалов вскрыла последняя сыгранная миссия. null — ещё ни одной. */
	lastFailCount: number | null;
	/** Партия кончилась, роли открыты всем (FR-10). */
	isRolesRevealed: boolean;
}
