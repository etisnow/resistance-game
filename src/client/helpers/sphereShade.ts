import * as PIXI from 'pixi.js';

/**
 * Стеклянная сфера поверх кружка игрока — того самого «яйца», которым он сидит
 * за столом.
 *
 * Сам кружок теперь залит сплошным цветом (см. badgeColorOf), и весь его объём
 * держит эта наклейка: жёсткий белый блик, чистый цвет под ним и тёмная кайма по
 * дальней от света кромке. Границы у блика и у каймы резкие — так шарик читается
 * стеклянным, а не залитым мягкой светотенью, которая только мылит и цвет, и
 * картинку карты под ним.
 *
 * Ложится она одинаково на всех: и на цветное яйцо, и на натянутую карту статуса
 * (нечто, заражение, карантин — см. StatusSkin). Поэтому свет за столом у всех с
 * одной стороны, а край ни у кого не режется по столу ровной яркой границей.
 *
 * Запекаем один раз в канвас: градиентов у PIXI.Graphics нет, а держать ради
 * этого картинку в ресурсах незачем — сфера целиком описывается числами ниже.
 */

// Где стоит источник света, в долях размера от левого верхнего угла.
const lightX = 0.3;
const lightY = 0.23;

// Блик: плоское белое пятно с резкой кромкой. Радиус (в долях размера), доля
// радиуса, до которой он держит полную силу, и ширина схода на нет — сход почти
// нулевой, кромка должна быть именно резкой.
const highlightSpan = 0.12;
const highlightEdge = 0.7;
const highlightSoft = 0.02;
const highlightAlpha = 0.38;
// Сплюснутость блика по вертикали. Текстура квадратная, а кружок вытянут (см.
// badgeAspect), поэтому круглый блик растянулся бы вместе с ней в овал.
const highlightFlat = 0.8;
// Блик не должен доставать до края кружка: срезанный краем, он читается дыркой в
// яйце, а не отражением на нём. Отсюда и место света — оно отодвинуто от края
// дальше, чем сумма его смещения и радиуса.

// Тень: доля расстояния от источника света, с которой начинается кайма, ширина
// перехода в неё и её сила — сразу за границей и у самого края кружка. Начинается
// она далеко, поэтому кайма выходит узкой полоской по дальней кромке, а не
// затемнением половины яйца.
//
// Отсчитывается она от света, поэтому вместе с ним и едет: сдвинули источник
// дальше от края — и та же доля даёт кайму шире. До дальнего края кружка отсюда
// 0.836 размера, так что на кайму остаётся полоска в 0.046.
const shadeFrom = 0.79;
const shadeSoft = 0.02;
const shadeAlpha = 0.62;
const shadeEdgeAlpha = 1;

// Рефлекс: светлая кромка по тёмной стороне — свет, отражённый столом. Без него
// кайма читается грязью, а не тенью на круглом. Центр его кольца сдвинут к
// источнику света — тогда кольцо выходит полумесяцем с той стороны, где кайма.
//
// Ширина — в долях радиуса кружка, и отмеряется она внутрь от дальнего края
// кольца, а не долей его радиуса: сдвинутое кольцо у дальней стороны выходит за
// край кружка, и одна и та же доля давала бы полосу тем шире, чем дальше уехал
// свет.
const rimReach = 0.22;
const rimAlpha = 0.18;
const rimPull = 0.34;

let cached: PIXI.Texture | null = null;

export const sphereShadeTexture = (size = 256): PIXI.Texture => {
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Нет 2d-контекста для светотени кружка');

	const radius = size / 2;
	const lit = {x: size * lightX, y: size * lightY};

	// Рисуем только внутри круга: за его пределами текстура должна остаться
	// прозрачной, иначе сфера вылезет углами за кружок.
	context.save();
	context.beginPath();
	context.ellipse(radius, radius, radius, radius, 0, 0, Math.PI * 2);
	context.clip();

	// Кайма. Центр градиента — у источника света, поэтому темнеет дальняя от него
	// сторона, а до неё кружок остаётся чистого цвета.
	const shade = context.createRadialGradient(lit.x, lit.y, 0, lit.x, lit.y, size);
	shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
	shade.addColorStop(shadeFrom, 'rgba(0, 0, 0, 0)');
	shade.addColorStop(shadeFrom + shadeSoft, `rgba(0, 0, 0, ${shadeAlpha})`);
	shade.addColorStop(1, `rgba(0, 0, 0, ${shadeEdgeAlpha})`);
	context.fillStyle = shade;
	context.fillRect(0, 0, size, size);

	// Рефлекс.
	const rim = {
		x: radius + (lit.x - radius) * rimPull,
		y: radius + (lit.y - radius) * rimPull,
	};
	// Дальний край кольца — самая дальняя от его центра точка кружка.
	const rimFar = radius + Math.hypot(rim.x - radius, rim.y - radius);
	const reflex = context.createRadialGradient(
		rim.x, rim.y, Math.max(0, rimFar - radius * rimReach),
		rim.x, rim.y, rimFar,
	);
	reflex.addColorStop(0, 'rgba(255, 255, 255, 0)');
	reflex.addColorStop(1, `rgba(255, 255, 255, ${rimAlpha})`);
	context.fillStyle = reflex;
	context.fillRect(0, 0, size, size);

	// Блик — последним, поверх всего: он и есть самое яркое место на шарике.
	context.save();
	context.translate(lit.x, lit.y);
	context.scale(1, highlightFlat);
	const highlight = context.createRadialGradient(0, 0, 0, 0, 0, size * highlightSpan);
	highlight.addColorStop(0, `rgba(255, 255, 255, ${highlightAlpha})`);
	highlight.addColorStop(highlightEdge, `rgba(255, 255, 255, ${highlightAlpha})`);
	highlight.addColorStop(highlightEdge + highlightSoft, 'rgba(255, 255, 255, 0)');
	context.fillStyle = highlight;
	// Сжатый по вертикали холст: закрашиваем с запасом, обрезает всё равно круг.
	context.fillRect(-size, -size * 2, size * 2, size * 4);
	context.restore();

	context.restore();

	cached = PIXI.Texture.from(canvas);
	return cached;
};
