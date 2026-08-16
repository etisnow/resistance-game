import type {CSSProperties} from 'react';
import {each} from 'lodash';
import {EGameLogType} from 'shared/enum/gameLogType';
import {EPlayerState} from 'shared/enum/player';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';
import type GameController from 'client/controllers/gameController';

// Стек действий: одна законченная вещь на столе — одна карточка. Тип строки лога
// и есть её «лицо»: по нему выбирается знак, цвет и подпись в подсказке. Лентой
// строк то же самое читалось хуже — за партию их набегает под сотню, а помнить
// надо не текст, а ход событий.

// Знаки — из того же словаря, каким стол говорит о себе: палец вниз у отклонения
// такой же, как жетон голоса и деление счётчика, галочка с крестиком — как на
// треке миссий.
export const ACTION_ICONS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: '⚙',
	[EGameLogType.team]: '🎯',
	// Поднятая рука, а не урна (🗳): урны нет в цветных наборах половины систем,
	// и на её месте остаётся серая коробка.
	[EGameLogType.vote]: '🙋',
	[EGameLogType.reject]: '👎',
	[EGameLogType.mission]: '🚀',
	[EGameLogType.success]: '✅',
	[EGameLogType.fail]: '❌',
	[EGameLogType.info]: '•',
};

// Подпись в шапке подсказки: одним словом, что это было.
export const ACTION_LABELS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: 'Служебное',
	[EGameLogType.team]: 'Набор',
	[EGameLogType.vote]: 'Голосование',
	[EGameLogType.reject]: 'Отклонено',
	[EGameLogType.mission]: 'Миссия',
	[EGameLogType.success]: 'Успех',
	[EGameLogType.fail]: 'Провал',
	[EGameLogType.info]: 'Событие',
};

// Ровно шесть шестнадцатеричных цифр: к цвету дописывается прозрачность (см.
// getActionColors), поэтому короткая запись здесь не годится.
//
// Зелёный и красный — те же, что у миссий на треке, синий — цвет прицела: стек и
// стол должны говорить об одном одинаково.
export const ACTION_COLORS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: '#8a97a0',
	[EGameLogType.team]: '#5ec8f0',
	[EGameLogType.vote]: '#ffd93d',
	[EGameLogType.reject]: '#dd6a5d',
	[EGameLogType.mission]: '#a29bfe',
	[EGameLogType.success]: '#5ca98d',
	[EGameLogType.fail]: '#dd6a5d',
	[EGameLogType.info]: '#7a8288',
};

export const getActionType = (entry: IGameLogEntry): EGameLogType => entry.type || EGameLogType.info;

export const getActionIcon = (entry: IGameLogEntry): string =>
	ACTION_ICONS[getActionType(entry)] || ACTION_ICONS[EGameLogType.info];

const colorVars = (color: string) => ({
	'--action-color': color,
	'--action-edge': `${color}8c`,
	'--action-glow': `${color}55`,
	'--action-tint': `${color}38`,
} as CSSProperties);

export const getActionColors = (type: EGameLogType) =>
	colorVars(ACTION_COLORS[type] || ACTION_COLORS[EGameLogType.info]);

// Чего ждут от игрока прямо сейчас, стек не показывает: об этом говорит надпись
// над столом (см. ActionInteracter), и повторять её плашкой в стеке — значит
// сказать одно и то же дважды. Стек — про то, что уже случилось.

// Сид пишется отдельной строкой прямо перед «Игра началась» (см. Game.start) —
// это одно событие, разбитое надвое, поэтому сид уезжает в подсказку к старту
// игры, а не занимает собой первую карточку стека.
const GAME_SEED = 'Сид игры';

// Типы, у которых идущие подряд строки — это один шаг, а не несколько.
const GLUED_TYPES = new Set<EGameLogType>([EGameLogType.team, EGameLogType.vote]);

export interface IStackEntry {
	// Номер строки в полном логе: он только растёт, поэтому карточка не меняет
	// личность, пока стек сдвигается под ней.
	id: number;
	entry: IGameLogEntry;
	// Приклеенные к карточке строки: показываются в подсказке под основной.
	details: string[];
}

export const getStackEntries = (gameLog: IGameLogEntry[]): IStackEntry[] => {
	const entries: IStackEntry[] = [];
	// Строки, ждущие своей карточки: они пишутся раньше события, к которому
	// относятся (сид — перед стартом игры).
	let pending: string[] = [];
	each(gameLog, (entry, index) => {
		if (entry.text.startsWith(GAME_SEED)) {
			pending.push(entry.text);
			return;
		}
		const last = entries.length ? entries[entries.length - 1] : undefined;
		const type = getActionType(entry);
		// Шаг идёт несколькими строками подряд — карточка у него одна: набор
		// команды сервер пишет по строке на каждого выбранного, голосование —
		// «голосуем» и «вот кто как». Пять карточек с одним знаком заняли бы собой
		// весь стек, ничего к нему не добавив.
		if (last && GLUED_TYPES.has(type) && getActionType(last.entry) === type) {
			last.details.push(entry.text);
			return;
		}
		entries.push({id: index, entry, details: pending});
		pending = [];
	});
	return entries;
};

// Сколько игроков за столом — столько карточек в стеке и держим. Правило то же,
// что было у ленты логов: шагов видно ровно на круг стола.
export const getStackCapacity = (controller: GameController): number => {
	let count = 0;
	each(controller.players, (player) => {
		if (!player) return;
		if (player.state === EPlayerState.door) return;
		count++;
	});
	return Math.max(count, 1);
};

export interface IStackGeometry {
	cardWidth: number;
	cardHeight: number;
	// Шаг между соседними карточками. Меньше ширины — значит они лежат внахлёст.
	step: number;
	trackWidth: number;
}

const CARD_RATIO = 1.46;
const MAX_CARD_WIDTH = 52;
const MIN_CARD_WIDTH = 24;
// Карточки всегда лежат стопкой — слегка друг на друге, а не в ряд с зазором.
const STEP_SHARE = 0.8;
// Глубже половины карточки не наезжаем: под иконку нужно место (см. --action-sliver).
const MIN_STEP_SHARE = 0.5;

export const getStackGeometry = (available: number, capacity: number): IStackGeometry => {
	const slots = Math.max(capacity, 1);
	const fit = (cardWidth: number, share: number): IStackGeometry => ({
		cardWidth,
		cardHeight: Math.round(cardWidth * CARD_RATIO),
		step: cardWidth * share,
		trackWidth: (slots - 1) * cardWidth * share + cardWidth,
	});
	const loose = fit(MAX_CARD_WIDTH, STEP_SHARE);
	if (slots === 1 || loose.trackWidth <= available) return loose;
	// Тесно: наезжают сильнее, но не глубже половины карточки.
	const share = Math.max(MIN_STEP_SHARE, (available - MAX_CARD_WIDTH) / ((slots - 1) * MAX_CARD_WIDTH));
	const packed = fit(MAX_CARD_WIDTH, share);
	if (packed.trackWidth <= available) return packed;
	// Совсем тесно: нахлёст уже предельный, уменьшаем сами карточки.
	const cardWidth = Math.max(MIN_CARD_WIDTH, available / (MIN_STEP_SHARE * (slots - 1) + 1));
	return fit(cardWidth, MIN_STEP_SHARE);
};
