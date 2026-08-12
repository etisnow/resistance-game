import {clamp} from 'lodash';
import {tableField} from 'client/helpers/window';
import {cardAspectRatio} from 'shared/constant/cards';

// Доля свободного поля, которую оставляем по краям стола.
const roomMargin = 0.04;

/**
 * Стол видно не сверху, а из-за его края: круг в такой проекции — эллипс,
 * сжатый по вертикали вот во столько раз. Отсюда же берётся и глубина: чем выше
 * место на экране, тем оно дальше от смотрящего, и сидящих на дальней половине
 * наполовину загораживает сама столешница (см. Room).
 *
 * Один и тот же коэффициент задаёт форму и круга рассадки, и столешницы, и тени
 * под колодой — иначе «камера» смотрела бы на разные предметы под разными
 * углами и стол рассыпался бы на несвязанные эллипсы.
 */
export const tableSquash = 0.58;

// Кружок игрока — это стоящая за столом фигура, а не лежащая на столе фишка:
// по вертикали он вытянут вот во столько раз (см. PlayerBadge).
export const badgeAspect = 1.26;

// Зазор между соседями по кругу: во сколько раз шаг между ними больше ширины
// кружка.
const badgeGap = 1.1;
// Кружок не шире этой доли большой полуоси: иначе игроки смыкаются над столом и
// самого стола не видно.
const maxBadgeShare = 0.55;

// Половина свободного поля — в неё вписываем круг рассадки вместе с кружками.
const roomExtents = () => {
	const field = tableField();
	return {
		x: Math.max(0, (field.width / 2) * (1 - roomMargin)),
		y: Math.max(0, (field.height / 2) * (1 - roomMargin)),
	};
};

export const degToRag = (deg: number) => (deg * (Math.PI/180));

/**
 * Ширина кружка в долях большой полуоси круга рассадки.
 *
 * Теснее всего соседи сидят у боков стола: там эллипс уходит вглубь, и на
 * экране места разделяет только сжатая вертикаль. Расстояние между соседними
 * местами (rx·cos t, ry·sin t) равно 2·sin(π/N)·√(rx²sin²u + ry²cos²u), то есть
 * минимум — ровно 2·ry·sin(π/N), у самого бока.
 *
 * Меряем этот просвет шириной кружка, а не высотой: кружки вытянуты вверх, и
 * лёгкое перекрытие по вертикали у боков стола читается как глубина — дальний
 * стоит за ближним, — а не как наезжающие друг на друга бейджи.
 */
const badgeShareOfRadius = (count: number) =>
	Math.min(maxBadgeShare, (2 * tableSquash * Math.sin(Math.PI / Math.max(count, 2))) / badgeGap);

/**
 * Ширина кружка игрока.
 *
 * Кружок настолько крупный, насколько влезает: сверху его ограничивают либо шаг
 * между соседями по кругу, либо доля полуоси, либо само свободное поле — в него
 * круг рассадки должен войти вместе с кружками, причём по вертикали кружок
 * занимает в badgeAspect раз больше.
 */
export const playerRoomDiag = (count: number) => {
	const extents = roomExtents();
	const share = badgeShareOfRadius(count);
	// rx из двух условий: rx + share·rx/2 ≤ availX и rx·squash + share·rx·aspect/2 ≤ availY.
	const rx = Math.min(
		extents.x / (1 + share / 2),
		extents.y / (tableSquash + (share * badgeAspect) / 2),
	);
	return clamp(share * rx, 36, 220);
};

/**
 * Полуоси эллипса, по которому рассажены игроки. Форму задаёт проекция
 * (tableSquash), размер — свободное поле за вычетом самого кружка.
 */
export const roomRadii = (count: number) => {
	const extents = roomExtents();
	const width = playerRoomDiag(count);
	const rx = Math.max(0, Math.min(
		extents.x - width / 2,
		(extents.y - (width * badgeAspect) / 2) / tableSquash,
	));
	return {rx, ry: rx * tableSquash};
};

// Насколько столешница уже круга рассадки, в долях ширины кружка. Игроки сидят
// ВОКРУГ стола, а не на нём: у ближних край стола проходит по груди, дальних он
// на столько же загораживает.
const tableEdgeShare = 0.42;

/**
 * Полуоси самой столешницы. Она вписана в круг рассадки: дальние игроки
 * оказываются за ней (и она их подрезает), ближние — перед ней.
 */
export const tableRadii = (count: number) => {
	const {rx} = roomRadii(count);
	const surfaceRx = Math.max(0, rx - playerRoomDiag(count) * tableEdgeShare);
	return {rx: surfaceRx, ry: surfaceRx * tableSquash};
};

// Толщина борта: столешница не плёнка, у неё видно торец.
export const tableThickness = (count: number) => clamp(tableRadii(count).ry * 0.13, 3, 24);

// Насколько лежащие на столе карты сдвинуты от середины столешницы вглубь, в
// долях её малой полуоси. У ближнего края стоят игроки — они заходят на стол
// грудью (см. tableEdgeShare), и колода из-под них выглядывала бы краем.
const tableCardLift = 0.16;

/**
 * Где на столе лежат карты — колода и сработавшая паника. Точка одна на всех,
 * кто с колодой работает: по ней же рука тянет карту в веер, а стол — чужую
 * карту к её хозяину (см. Hand и CardDraw).
 */
export const tableCardPoint = (count: number): {x: number, y: number} =>
	({x: 0, y: -tableRadii(count).ry * tableCardLift});

/**
 * Ширина карты в колоде. Колода лежит посреди стола и должна читаться издалека,
 * но столешница вокруг неё обязана остаться видна — иначе стола снова нет.
 *
 * По высоте карта лежит в проекции стола (её сжимает tableSquash, см. Card), и
 * места ей нужно ровно на столько меньше.
 */
export const deckCardWidth = (count: number) => {
	const {rx, ry} = tableRadii(count);
	return clamp(Math.min(rx * 0.62, (ry * 1.1) / (cardAspectRatio * tableSquash)), 44, 260);
};

/**
 * Рассадка за столом.
 *
 * По умолчанию она абсолютная — это сам playersList, один и тот же у всех: стол
 * один на всех, и переезжают по нему только те, кого действительно пересадили
 * (смена мест, дверь, топор).
 *
 * «Стол от первого лица» (настройка в меню, см. isFirstPersonTable) прокручивает
 * список так, чтобы смотрящий сидел первым — то есть внизу, под своей рукой.
 * Тогда каждый видит свой стол, зато свои соседи всегда на одних и тех же
 * местах. Мертвеца в списке нет, ему в любом случае показывают стол как есть.
 *
 * Живёт здесь, а не в Room: по этому же кругу рука считает, откуда прилетает и
 * куда улетает карта обмена (см. Hand), а посчитанный второй раз он однажды со
 * столом разъедется.
 */
export const roomPlayerOrder = (playersList: string[], viewerId: string, isFirstPerson: boolean): string[] => {
	const index = playersList.indexOf(viewerId);
	if (!isFirstPerson || index < 0) return [...playersList];
	return [...playersList.slice(index), ...playersList.slice(0, index)];
};

// Насколько ближние места стянуты к нижнему. 1 — рассадка ровно по эллипсу,
// больше — сильнее сгоняет ближних в кучу у нижнего края.
const nearSeatPull = 1.3;

/**
 * Небольшой сдвиг мест ближней половины к нижнему месту.
 *
 * Ровно по эллипсу внизу стола просторно (там он широкий), а по бокам тесно —
 * и именно между боковыми соседями стол рисует стрелки со значками обмена,
 * которым туда не влезть. Поэтому ближние места чуть сгоняются к нижнему, и
 * освободившееся место достаётся боковым промежуткам.
 *
 * Дальняя половина сидит как сидела: её и так подрезает столешница. Места на
 * самих боках (±90° от нижнего) не двигаются вовсе — иначе рассадка разъехалась
 * бы на стыке половин.
 */
const pullSeatToFront = (deg: number): number => {
	// Отклонение от нижнего места, −180..180.
	const away = ((((deg - 90) % 360) + 540) % 360) - 180;
	const shift = Math.abs(away);
	if (shift >= 90) return deg;
	return 90 + Math.sign(away) * 90 * Math.pow(shift / 90, nearSeatPull);
};

/**
 * Угол места игрока за столом, в градусах. Отсчёт от +90°, поэтому первый в
 * рассадке сидит внизу — ближе всех к смотрящему.
 */
export const roomPlayerAngle = (playerId: string, playerOrder: string[]): number =>
	pullSeatToFront((360 / Math.max(playerOrder.length, 1)) * playerOrder.indexOf(playerId) + 90);

/**
 * Точка на круге рассадки по углу. Пересадка — это движение ПО кругу, поэтому
 * стол анимирует угол, а не координаты, и берёт точку отсюда (см. Room).
 */
export const roomPointAt = (deg: number, count: number): {x: number, y: number} => {
	const rad = degToRag(deg);
	const {rx, ry} = roomRadii(count);
	return {x: rx * Math.cos(rad), y: ry * Math.sin(rad)};
};

/**
 * Место игрока за столом относительно его центра.
 */
export const roomPlayerPoint = (playerId: string, playerOrder: string[]): {x: number, y: number} =>
	roomPointAt(roomPlayerAngle(playerId, playerOrder), playerOrder.length);

/**
 * Сидит ли место на дальней половине стола — той, что уходит за столешницу.
 * Дальних рисуют ДО стола, ближних — после (см. Room).
 */
export const isFarSeat = (deg: number): boolean => Math.sin(degToRag(deg)) < 0;

/**
 * Тот же угол, но «размотанный» рядом с предыдущим: пересаженный игрок должен
 * доехать до нового места по кругу и кратчайшей дугой, а не по прямой через
 * стол и не через весь стол в обход. Без этого пружина, увидев скачок с 350° на
 * 10°, поехала бы назад через всю рассадку.
 */
export const unwrapAngle = (deg: number, previous: number | undefined): number => {
	if (previous === undefined) return deg;
	const delta = ((((deg - previous) % 360) + 540) % 360) - 180;
	return previous + delta;
};
