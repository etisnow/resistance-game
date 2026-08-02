import {CustomPIXIComponent} from 'react-pixi-fiber';
import {isUndefined, omitBy} from 'lodash';
import * as PIXI from 'pixi.js';
import {noiseGlsl} from 'client/components/pixiPrimitives/noiseGlsl';

// Пламя целиком считается на видеокарте: четырёхугольник и фрагментный шейдер,
// который рисует по нему языки огня, струю огнемёта, искры и дым. Спрайтовой анимации у нас нет,
// а покадрово гонять сотни частиц через react-pixi-fiber дорого — на каждый кадр
// это был бы обход дерева примирителя.
//
// Время и «сколько горения прошло» приходят пропсами: их гонит пружина
// react-spring снаружи (см. AnimatedPixi.Fire), так что своего тикера у огня нет.

// Сколько искр в струе. Их состояние считает процессор и кладёт в uniform-массив
// (см. updateJetParticles): для шейдера это всего лишь чтение готовых чисел.
const JET_PARTICLES = 28;

const vertex = `
attribute vec2 aVertexPosition;
attribute vec2 aUv;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;

varying vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}
`;

const fragment = `
// Точность нарочно highp: шум считается от координат, умноженных на десятки, и
// на mediump они теряют разряды — рисунок пламени вырождается в полосы или
// пропадает совсем, причём по-разному в разных браузерах.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;

// Секунды с начала горения: ими живёт вся турбулентность.
uniform float uTime;
// 0..1 — сколько горения прошло: пламя разгорается, держится и опадает.
uniform float uLife;
// Свой у каждого костра: иначе два пожара на столе горят кадр в кадр одинаково.
uniform float uSeed;
// Ширина квада к его высоте: без этого пламя растягивается вместе с ним.
uniform float uAspect;
// Где на кваде находится тот, кого жгут, в долях его высоты. У костра в этой
// точке держится раскалённое ядро, у струи — цель, до которой она бьёт прямо, а
// уже за ней начинает разбрасывать.
uniform float uOrigin;
// Что именно рисуем: 0 — костёр, 1 — струя из огнемёта, 2 — дым, 3 — пепел,
// 4 — вспышка с ударной волной.
// Считаются они по-разному, но живут от одних и тех же uTime/uLife (см. ветки
// в main).
uniform float uMode;
// Искры струи: xy — место (снос поперёк и путь вдоль), z — размер, w — жизнь.
uniform vec4 uSparks[${JET_PARTICLES}];
uniform vec3 uSparkColors[${JET_PARTICLES}];

${noiseGlsl}

void main() {
	// Основание пламени — низ квада: up растёт вверх (0..1), x идёт поперёк от
	// оси столба к краям квада (-1..1). Шум же считаем в единицах высоты (sx),
	// иначе на узком кваде его клетки растянутся в горизонтальные полосы.
	float up = 1.0 - vUv.y;
	float x = (vUv.x - 0.5) * 2.0;
	float sx = x * uAspect * 0.5;

	// Пламя разгорается быстро, держится, пока есть чему гореть, и опадает уже
	// к самому концу — вместе с последними остатками кружка.
	float power = smoothstep(0.0, 0.12, uLife) * (1.0 - smoothstep(0.78, 1.0, uLife));

	if (uMode > 3.5) {
		// Вспышка и ударная волна в тот миг, когда струя достаёт до игрока. Живут
		// на своём кваде — большом и квадратном, с бейджем ровно посередине. В
		// кваде костра волна упиралась бы в его края и обрывалась по ним прямыми
		// линиями: костёр узкий и высокий, а волна расходится во все стороны.
		float d = length(vec2(sx, up - 0.5));
		float phase = clamp(uLife / 0.16, 0.0, 1.0);
		float flash = exp(-uLife * 20.0) * exp(-d * 9.0) * 1.3;
		float ring = exp(-pow((d - 0.02 - phase * 0.4) / 0.045, 2.0)) * (1.0 - phase);
		float burstAlpha = clamp(flash + ring, 0.0, 1.0);
		vec3 burstColor = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.93, 0.72), burstAlpha);
		gl_FragColor = vec4(burstColor * burstAlpha, burstAlpha);
		return;
	}

	if (uMode > 2.5) {
		// Пепел: редкие чёрные хлопья, летящие вместе с огнём. Слой отдельный,
		// потому что огонь светится (складывается с фоном), а пепел, наоборот,
		// должен темнить — в одном проходе это не совмещается.
		// Ниже основания и выше полосы, где пепел живёт, считать нечего — а там
		// девять клеток с хешами на каждый пиксель.
		float ashAlive = smoothstep(0.0, 0.06, up) * (1.0 - smoothstep(0.7, 1.0, up));
		if (ashAlive <= 0.0) {
			gl_FragColor = vec4(0.0);
			return;
		}
		vec2 grid = vec2(sx * 11.0, up * 11.0 - uTime * 2.2) + uSeed * 11.0;
		vec2 cell = floor(grid);
		vec2 inCell = fract(grid);
		float speck = 0.0;
		// Хлопья длиннее своей клетки и торчат из неё, поэтому проверяем и соседние:
		// иначе штрихи обрубает по границам сетки.
		for (int gy = -1; gy <= 1; gy++) {
			for (int gx = -1; gx <= 1; gx++) {
				vec2 near = cell + vec2(float(gx), float(gy));
				float r1 = hash(near);
				if (r1 < 0.55) continue;
				float r2 = hash(near + 17.0);
				float r3 = hash(near + 41.0);
				// Хлопье лежит в своей клетке не по центру, иначе пепел ложится сеткой.
				vec2 p = inCell - vec2(float(gx), float(gy)) - vec2(0.25 + 0.5 * r2, 0.25 + 0.5 * r3);
				float ang = r2 * 6.283;
				float ca = cos(ang);
				float sa = sin(ang);
				vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
				// Не палочка, а дужка: хлопья пепла закручивает на лету.
				q.y -= (r3 - 0.5) * 3.2 * q.x * q.x;
				// half — зарезервированное слово в GLSL, отсюда и имя.
				float halfLen = 0.14 + 0.2 * r3;
				float thick = 0.012 + 0.02 * r2;
				float d = length(vec2(max(abs(q.x) - halfLen, 0.0), q.y));
				speck = max(speck, smoothstep(thick, thick * 0.25, d));
			}
		}
		// У кромок пепла больше: в раскалённой середине ему гореть и гореть.
		float edgeBias = 0.35 + 0.65 * smoothstep(0.05, 0.5, abs(x));
		float ashAlpha = speck * edgeBias * ashAlive * power;
		gl_FragColor = vec4(vec3(0.015, 0.012, 0.012) * ashAlpha, ashAlpha);
		return;
	}

	if (uMode > 1.5) {
		// Дым: клубы, что тянутся вверх, пока горит и после. Цвет у него серый, а
		// не чёрный: на тёмном столе чёрный дым не виден вовсе — его подсвечивает
		// снизу тот же огонь. Плотность обязана сойти на нет у всех четырёх кромок
		// квада, иначе вместо облака проступит серый прямоугольник.
		float rise = smoothstep(0.12, 0.45, uLife) * (1.0 - smoothstep(0.9, 1.0, uLife));
		float edges = (1.0 - smoothstep(0.55, 1.0, abs(x)))
			* (1.0 - smoothstep(0.55, 1.0, up)) * smoothstep(0.0, 0.18, up);
		if (edges * rise <= 0.0) {
			gl_FragColor = vec4(0.0);
			return;
		}
		vec2 sq = vec2(sx * 3.4, up * 1.9 - uTime * 0.8) + uSeed * 3.1;
		float wob = fbm(sq * 2.1);
		float puff = fbm(sq + vec2((wob - 0.5) * 1.4, -(wob - 0.5) * 0.8));
		float drift = (fbm(vec2(uSeed * 6.0, up * 2.0 - uTime * 0.6)) - 0.5) * 0.8 * up;
		float spread = 0.18 + 0.6 * up;
		float body = 1.0 - smoothstep(spread * 0.2, spread, abs(x - drift));
		float density = clamp((puff * 2.2 - 0.45) * 1.5, 0.0, 1.0) * body * edges * rise;
		// Подсвеченный снизу дым: у огня он теплее и светлее, выше — серый.
		vec3 smokeColor = mix(vec3(0.38, 0.27, 0.21), vec3(0.19, 0.19, 0.2), smoothstep(0.05, 0.5, up));
		gl_FragColor = vec4(smokeColor * density, density);
		return;
	}

	if (uMode > 0.5) {
		// Струя огнемёта — рой частиц, летящих от сопла: каждая светит по закону
		// обратных квадратов, и их свечения складываются в один сплошной поток.
		// Отдельными клубами он читался бы как гирлянда колец, а ровным конусом с
		// ползущей внутри текстурой — как неподвижная картинка; здесь же поток
		// живёт сам собой, потому что частицы летят, стареют и гаснут.
		// Досюда не достаёт ни одна частица — а цикл ниже стоит дороже всего
		// остального огня вместе взятого, и на пустой пиксель его гонять незачем.
		// Оценка сверху: самая крупная из тех, что могли долететь до этой высоты,
		// плюс предельный снос потока в этом месте.
		float ampHere = 0.05 * smoothstep(0.0, uOrigin * 0.9, up)
			+ 0.55 * smoothstep(uOrigin, 1.0, up);
		float sizeHere = (0.034 + 0.115 * min(1.0, up / 1.04 + 0.4)) * 1.35;
		if (abs(sx) > 0.54 * ampHere + 2.2 * sizeHere) {
			gl_FragColor = vec4(0.0);
			return;
		}

		float glow = 0.0;
		vec3 tint = vec3(0.0);
		// Где какая частица, какого размера и какого цвета — считает процессор
		// один раз на кадр (см. updateJetParticles). Раньше это делал каждый
		// пиксель заново: хеш, два синуса и четыре smoothstep на частицу, то есть
		// одна и та же работа миллионы раз подряд.
		for (int i = 0; i < ${JET_PARTICLES}; i++) {
			// x — снос поперёк потока, y — сколько пролетела, z — размер,
			// w — насколько ещё жива.
			vec4 spark = uSparks[i];
			// Дальше 2.2 своих размеров частица не светит вовсе: вычитание ниже
			// обнуляет яркость точно. Для такого пикселя её можно не считать.
			float reach2 = 2.2 * spark.z;
			if (abs(up - spark.y) > reach2) continue;
			if (abs(sx - spark.x) > reach2) continue;
			vec2 rel = vec2(sx - spark.x, up - spark.y) / max(spark.z, 0.01);
			// Свечение по закону обратных квадратов, но с обрезанным хвостом: у
			// честного 1/d² хвост бесконечный, и он затягивает весь квад дымкой.
			float brightness = max(0.34 / (dot(rel, rel) + 0.06) - 0.06, 0.0) * spark.w;
			glow += brightness;
			tint += uSparkColors[i] * brightness;
		}
		// У самого сопла — раскалённое устье: огонь всё-таки откуда-то бьёт.
		float muzzle = exp(-up * 16.0) * exp(-abs(sx) * 9.0) * 1.4;
		glow += muzzle;
		tint += vec3(1.0, 0.98, 0.9) * muzzle;
		// По краям квада гасим принудительно, и гасим издалека: свечение частиц
		// достаёт до самой кромки, а узкая полоска затухания у края читается как
		// прямая линия поперёк стола.
		glow *= (1.0 - smoothstep(0.45, 1.0, abs(x))) * (1.0 - smoothstep(0.7, 1.0, up))
			* smoothstep(0.0, 0.05, up);

		// Порог, а не просто масштаб: у свечения длинный слабый ореол, и на кваде
		// в полстола он читается как мутное пятно поверх всего.
		float jetAlpha = smoothstep(0.06, 0.3, glow) * power;
		// Добела раскалено только ядро потока; по краям, где свечения меньше, он
		// остывает до жёлтого и красного.
		vec3 jetColor = tint / max(glow, 0.0001);
		vec3 cool = mix(vec3(1.0, 0.14, 0.01), vec3(1.0, 0.72, 0.06), smoothstep(0.08, 0.5, glow));
		jetColor = mix(cool, jetColor, smoothstep(0.3, 0.85, glow));
		// Сердцевина потока — добела: там свечений столько, что цвет уходит в белый.
		jetColor = mix(jetColor, vec3(1.0, 1.0, 0.96), smoothstep(1.6, 3.2, glow));
		gl_FragColor = vec4(jetColor * jetAlpha, jetAlpha);
		return;
	}

	// Края квада пламя не достаёт никогда (см. edgeFade ниже) — там незачем
	// считать шесть слоёв шума.
	if (abs(x) >= 1.0 || up >= 0.995 || power <= 0.0) {
		gl_FragColor = vec4(0.0);
		return;
	}

	// Языки: шум, ползущий вверх, со сдвигом координат самим собой (domain warp).
	// Без этого сдвига получается полосатая рябь, а не огонь. По горизонтали
	// клеток шума должно укладываться несколько — при слишком крупных клетках
	// пламя перестаёт зависеть от x и вырождается в гладкий силуэт свечки.
	// Поднимаясь, огонь ускоряется и растягивается — поэтому по высоте координата
	// шума не линейная: иначе рисунок ползёт вверх ровным ковром, будто это не
	// пламя, а прокручиваемая картинка.
	float flow = pow(up, 0.72) * 3.4;
	vec2 q = vec2(sx * 11.0, flow - uTime * 3.2) + uSeed * 7.3;
	// Два слоя искажения, и оба ползут по-своему: одним шумом пламя выходит
	// ровным и как будто застывшим, а от разнонаправленных языки закручивает.
	float swirlA = fbm(q * 0.9 + vec2(uTime * 0.5, -uTime * 0.8));
	float swirlB = fbm(q * 2.4 + vec2(-uTime * 0.9, uTime * 0.3) + 11.0);
	float turbulence = fbm(q + vec2(swirlA * 1.2 - swirlB * 0.6, -swirlA * 1.5 - swirlB * 0.4));

	// Столб качается из стороны в сторону и сужается кверху. Ширина везде
	// заметно меньше единицы: пламя должно сойти на нет внутри квада, иначе на
	// его краю останется рубленый край.
	float sway = (fbm(vec2(uSeed * 11.0, up * 1.6 - uTime * 1.3)) - 0.5) * 0.7 * up;

	// Шум растягиваем в полный размах: сам по себе fbm жмётся к середине, и
	// пламя из него выходит гладким конусом вместо рваных языков.
	float n = clamp((turbulence - 0.28) * 2.6, 0.0, 1.0);

	// Костёр дышит: весь столб то взмётывается, то оседает. Без этого силуэт
	// пламени стоит на месте, и сколько бы шума внутри ни ползло, огонь выглядит
	// нарисованным раз и навсегда.
	float breathe = fbm(vec2(uSeed * 3.7, -uTime * 1.1));
	// А каждый язык живёт ещё и сам по себе: вытягивается, отрывается и опадает,
	// пока соседний только поднимается.
	float tongue = fbm(vec2(x * 2.2 + uSeed * 5.0, -uTime * 1.7));

	// Столб сужается кверху, и сужается быстро: при равномерном сужении низ
	// пламени выходит колонной с прямыми боками.
	float reach = (0.25 + 0.70 * power) * (0.70 + 1.5 * breathe * tongue);
	float taper = pow(clamp(1.0 - up / reach, 0.0, 1.0), 0.55);
	float halfWidth = 0.05 + 0.34 * taper;
	// Языки ещё и виляют поперёк, каждый по-своему — иначе силуэт столба
	// остаётся ровным.
	float lick = (n - 0.5) * 0.7 * (0.25 + up) + (swirlA - 0.5) * 0.9 * up;
	float column = 1.0 - smoothstep(halfWidth * 0.15, halfWidth, abs(x - sway - lick));

	// Языки виляют широко и могут дойти до самого края квада — там пламя
	// обрубило бы прямой линией. Поэтому по краям гасим его принудительно.
	float edgeFade = (1.0 - smoothstep(0.72, 1.0, abs(x))) * (1.0 - smoothstep(0.88, 1.0, up));

	// Топливо: форма столба, изъеденная шумом. У самого основания пламя
	// сплошное, а выше решает уже шум — там языки и рвутся на клочья. Последний
	// множитель убирает рубленый край по нижней кромке квада.
	float fuel = column * mix(0.8, n * 1.15, smoothstep(-0.3, 0.25, up))
		* smoothstep(0.0, 0.18, up) * edgeFade;
	// Пламя мультяшное: не плавная растушёвка, а несколько плоских слоёв с
	// резкими кромками. Полоски smoothstep узкие — только чтобы кромка не
	// рвалась лесенкой.
	float flame = smoothstep(0.13, 0.17, fuel);
	float mid = smoothstep(0.42, 0.46, fuel);
	float yellow = smoothstep(0.72, 0.76, fuel);
	float white = smoothstep(0.94, 0.98, fuel);

	// Искры: сетка клеток, в каждой своя искра, летящая вверх быстрее пламени.
	// Их нарочно много — сожжение должно выглядеть громко.
	vec2 sparkGrid = vec2(sx * 14.0, up * 5.0 - uTime * 2.6) + uSeed * 5.0;
	vec2 cellId = floor(sparkGrid);
	vec2 cellUv = fract(sparkGrid) - 0.5;
	float cellRnd = hash(cellId);
	float ember = step(0.74, cellRnd) * smoothstep(0.24, 0.0, length(cellUv * vec2(1.0, 0.55)));
	ember *= exp(-abs(x) * 1.6) * (0.35 + 0.65 * hash(cellId + 3.0));

	// Раскалённое основание — там, где горит сам бейдж.
	float core = exp(-abs(up - uOrigin) * 9.0) * exp(-abs(x) * 4.0);

	// Плоские слои от алого к белому — один поверх другого, без переходов.
	vec3 color = vec3(1.00, 0.13, 0.01);
	color = mix(color, vec3(1.00, 0.45, 0.02), mid);
	color = mix(color, vec3(1.00, 0.82, 0.12), yellow);
	color = mix(color, vec3(1.00, 0.99, 0.90), white);
	color += vec3(1.00, 0.70, 0.25) * ember
		+ vec3(1.00, 0.35, 0.06) * core * 0.7;

	float alpha = clamp(flame * 0.9 + ember + core * 0.5, 0.0, 1.0) * power;
	gl_FragColor = vec4(color * alpha, alpha);
}
`;

export interface IFireProps {
	// Размеры столба пламени. Названия не width/height: те у контейнера пикси
	// свои — присвоение растянуло бы весь объект вместо перестройки квада.
	fireWidth: number;
	fireHeight: number;
	// Середина кружка игрока над основанием пламени, в долях высоты квада.
	originUp: number;
	time: number;
	life: number;
	seed: number;
	// Костёр (по умолчанию), струя огнемёта или дым — см. uMode в шейдере.
	mode?: 'fire' | 'jet' | 'smoke' | 'ash' | 'burst';
}

// Состояние искр струи на текущий кадр. Формулы те же, что раньше жили в
// шейдере: искра летит от сопла, стареет, раздувается, сносится потоком (до цели
// почти не сносится — из огнемёта целятся, а не машут им) и остывает от белого к
// красному. Считать это на пиксель было чистой потерей: для всего кадра значения
// одни и те же.
const updateJetParticles = (sparks: Float32Array, colors: Float32Array, {time, seed, originUp}: IFireProps) => {
	for (let i = 0; i < JET_PARTICLES; i++) {
		// Своя «случайность» у каждой искры: разброс по фазе, размеру и сносу.
		const rnd = (Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
		const random = rnd < 0 ? rnd + 1 : rnd;
		const age = (time * 0.95 + i / JET_PARTICLES + random * 0.02) % 1;
		const along = age * 1.04;
		const aim = smoothstep(0, originUp * 0.9, along);
		const past = smoothstep(originUp, 1, along);
		const amp = 0.05 * aim + 0.55 * past;
		const wander = (Math.sin(along * 4.5 - time * 4.2 + random * 6.283) * 0.16
			+ Math.sin(time * 1.7 + seed * 6.283) * 0.2
			+ (random - 0.5) * 0.18) * amp;
		sparks[i * 4] = wander;
		sparks[i * 4 + 1] = along;
		sparks[i * 4 + 2] = (0.034 + 0.115 * age) * (0.65 + 0.7 * random);
		sparks[i * 4 + 3] = smoothstep(1, 0.72, age);
		// Молодая искра бела, к старости желтеет и краснеет.
		const warm = smoothstep(0.03, 0.35, age);
		const cool = smoothstep(0.35, 0.85, age);
		colors[i * 3] = 1;
		colors[i * 3 + 1] = (1 - warm + 0.62 * warm) * (1 - cool) + 0.11 * cool;
		colors[i * 3 + 2] = (0.95 * (1 - warm) + 0.04 * warm) * (1 - cool) + 0.01 * cool;
	}
};

// Тот же smoothstep, что в GLSL: формулы искр обязаны совпадать с шейдерными.
const smoothstep = (edge0: number, edge1: number, value: number): number => {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0 || 1)));
	return t * t * (3 - 2 * t);
};

// Слой, который сейчас ничего не рисует, вообще не отдаём на отрисовку. Это не
// экономия на спичках: у струи квад в полстола, и её шейдер — самое дорогое, что
// есть на экране, а живёт она только первую половину костра. Пороги повторяют
// огибающие из шейдера: там, где они дают ноль, рисовать нечего.
const hasAnythingToDraw = (mode: IFireProps['mode'], life: number): boolean => {
	if (mode === 'burst') return life < 0.4;
	if (mode === 'smoke') return life > 0.1 && life < 1.0;
	return life > 0.0 && life < 1.0;
};

// Костёр помнит свои пропсы на себе, и вот почему: пружина react-spring, обновляя
// объект между кадрами, отдаёт applyProps ТОЛЬКО анимируемые значения (время и
// ход горения) — остальных в них просто нет. Брать их из такого обновления
// напрямую значит получить undefined: размеры квада стали бы NaN, а огонь —
// невидимым. Поэтому каждое обновление накладываем поверх запомненных.
type FireMesh = PIXI.Mesh & {fireProps?: IFireProps};

const quadUv = [0, 0, 1, 0, 1, 1, 0, 1];
const quadIndex = [0, 1, 2, 0, 2, 3];

// Пламя растёт вверх от начала координат: родителю остаётся поставить огонь
// туда, где он занялся.
const quadVertices = (width: number, height: number): number[] => {
	const half = width / 2;
	return [-half, -height, half, -height, half, 0, -half, 0];
};

const emptyFire: IFireProps = {
	fireWidth: 0,
	fireHeight: 0,
	originUp: 0,
	time: 0,
	life: 0,
	seed: 0,
	mode: 'fire',
};

const buildMesh = (): FireMesh => {
	const geometry = new PIXI.Geometry()
		.addAttribute('aVertexPosition', quadVertices(0, 0), 2)
		.addAttribute('aUv', quadUv, 2)
		.addIndex(quadIndex);
	const shader = PIXI.Shader.from(vertex, fragment, {
		uTime: 0,
		uLife: 0,
		uSeed: 0,
		uAspect: 1,
		uOrigin: 0,
		uMode: 0,
		uSparks: new Float32Array(JET_PARTICLES * 4),
		uSparkColors: new Float32Array(JET_PARTICLES * 3),
	});
	// Пламя кроет собой, а не подсвечивает: складывание (ADD) на нескольких слоях
	// огня разом уводит всю середину в белый, и вместо мультяшных языков выходит
	// засвеченное пятно. Плоские цвета поверх — ровно то, что нужно.
	return new PIXI.Mesh(geometry, shader);
};

const TYPE = 'Fire';
export const behavior = {
	customDisplayObject: (_props: IFireProps) => buildMesh(),
	customApplyProps: function(
		this: {applyDisplayObjectProps(oldProps: IFireProps | undefined, newProps: IFireProps): void},
		instance: FireMesh,
		oldProps: IFireProps | undefined,
		newProps: IFireProps,
	) {
		const known = instance.fireProps ?? emptyFire;
		const settings: IFireProps = {...known, ...omitBy(newProps, isUndefined) as Partial<IFireProps>};
		instance.fireProps = settings;
		const {fireWidth, fireHeight, originUp, time, life, seed, mode} = settings;

		// Перестраивать квад на каждый кадр незачем: размер меняется только вместе
		// с размером стола.
		if (known.fireWidth !== fireWidth || known.fireHeight !== fireHeight) {
			instance.geometry.getBuffer('aVertexPosition').update(new Float32Array(quadVertices(fireWidth, fireHeight)));
		}
		// Струя именно светит — её складываем с тем, что под ней. Костёр и дым,
		// наоборот, кроют собой: сложением их слои уводят середину в белый.
		instance.blendMode = (mode === 'jet' || mode === 'burst') ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;

		instance.renderable = hasAnythingToDraw(mode, life);
		if (mode === 'jet' && instance.renderable) {
			updateJetParticles(
				instance.shader.uniforms.uSparks as Float32Array,
				instance.shader.uniforms.uSparkColors as Float32Array,
				settings,
			);
		}

		const {uniforms} = instance.shader;
		uniforms.uTime = time;
		uniforms.uLife = life;
		uniforms.uSeed = seed;
		uniforms.uAspect = fireHeight > 0 ? fireWidth / fireHeight : 1;
		uniforms.uOrigin = originUp;
		uniforms.uMode = mode === 'burst' ? 4
			: (mode === 'ash' ? 3 : (mode === 'smoke' ? 2 : (mode === 'jet' ? 1 : 0)));
		this.applyDisplayObjectProps(oldProps, newProps);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
