import {CustomPIXIComponent} from 'react-pixi-fiber';
import {isUndefined, omitBy} from 'lodash';
import * as PIXI from 'pixi.js';
import {noiseGlsl} from 'client/components/pixiPrimitives/noiseGlsl';

// Контейнер, содержимое которого прогорает: фильтр выедает картинку по пятнам
// шума снизу вверх, оставляя по фронту раскалённую кромку и уголь перед ней.
// Это фильтр, а не второй спрайт поверх, потому что съедать нужно именно то, что
// нарисовано, — бейдж, ник и всё, что в контейнер положат.

const fragment = `
// Точность highp по той же причине, что и у пламени (см. Fire): на mediump шум
// прогорания вырождается, и бейдж либо не тает вовсе, либо исчезает разом.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vTextureCoord;

uniform sampler2D uSampler;
// Границы куска буфера, в котором лежит наша картинка: пикси сажает её в общий
// буфер фильтров, поэтому vTextureCoord — не 0..1 по содержимому.
uniform vec4 inputClamp;

// 0..1 — сколько бейджа уже съедено.
uniform float uBurn;
// 0..1 — насколько бейдж обуглился. Чернеет он весь и заранее, ещё до того, как
// огонь начнёт его выедать: горит не картинка, а человек.
uniform float uChar;
// Сила дрожания горячего воздуха.
uniform float uHeat;
uniform float uSeed;
uniform float uTime;

${noiseGlsl}

void main() {
	vec2 local = vTextureCoord / inputClamp.zw;

	// Раскалённый воздух: пока бейдж горит, картинка под ним дрожит.
	float wobbleX = fbm(local * 6.0 + vec2(uSeed, -uTime * 1.4)) - 0.5;
	float wobbleY = fbm(local * 6.0 + vec2(-uSeed, uTime * 1.1 + 4.0)) - 0.5;
	vec2 uv = clamp(vTextureCoord + vec2(wobbleX, wobbleY) * 0.02 * uHeat, inputClamp.xy, inputClamp.zw);
	vec4 tex = texture2D(uSampler, uv);

	// Фронт горения: пятна шума плюс уклон снизу вверх — низ занимается первым.
	float pattern = fbm(local * 3.5 + uSeed * 9.0) * 0.65 + (1.0 - local.y) * 0.35;
	float edge = uBurn * 1.45 - 0.22 - pattern;

	// За фронтом материала уже нет, на самом фронте — раскалённая кромка,
	// перед ним картинка успевает прогореть до угля.
	float alive = 1.0 - smoothstep(0.0, 0.035, edge);
	float rim = exp(-pow(edge / 0.075, 2.0)) * alive;
	// Обугливание идёт двумя волнами: весь кружок темнеет со временем, а перед
	// самым фронтом добирает до черноты.
	float charred = max(uChar * (0.35 + 0.65 * (1.0 - local.y)), smoothstep(-0.3, -0.02, edge));

	// Цвет в буфере уже умножен на альфу, поэтому гасим их вместе.
	vec4 color = tex * alive;
	color.rgb *= mix(1.0, 0.06, charred);
	// Уголь ещё и тлеет: по нему гуляют красные пятна, а по фронту идёт
	// раскалённая кромка.
	float embers = smoothstep(0.55, 0.85, fbm(local * 5.0 - vec2(0.0, uTime * 0.35) + uSeed));
	color.rgb += vec3(0.9, 0.25, 0.03) * embers * charred * alive * tex.a * 0.8;
	color.rgb += vec3(1.0, 0.45, 0.08) * rim * tex.a * 1.8;
	gl_FragColor = color;
}
`;

class BurnFilter extends PIXI.Filter {
	constructor() {
		super(undefined, fragment, {uBurn: 0, uChar: 0, uHeat: 0, uSeed: 0, uTime: 0});
	}
}

export interface IDissolveProps {
	burn: number;
	char: number;
	heat: number;
	seed: number;
	time: number;
}

// Пропсы держим на самом контейнере: пружина react-spring между кадрами отдаёт
// applyProps только анимируемые значения, поэтому неанимируемый seed в таком
// обновлении просто отсутствует — записать его как есть значило бы отправить в
// шейдер NaN и стереть бейдж целиком (см. тот же приём в Fire).
type DissolveContainer = PIXI.Container & {burnFilter?: BurnFilter; burnProps?: IDissolveProps};

const emptyBurn: IDissolveProps = {burn: 0, char: 0, heat: 0, seed: 0, time: 0};

const TYPE = 'Dissolve';
export const behavior = {
	customDisplayObject: (_props: IDissolveProps) => {
		const container: DissolveContainer = new PIXI.Container();
		const burnFilter = new BurnFilter();
		container.burnFilter = burnFilter;
		container.filters = [burnFilter];
		return container;
	},
	customApplyProps: function(
		this: {applyDisplayObjectProps(oldProps: IDissolveProps | undefined, newProps: IDissolveProps): void},
		instance: DissolveContainer,
		oldProps: IDissolveProps | undefined,
		newProps: IDissolveProps,
	) {
		const settings: IDissolveProps = {
			...(instance.burnProps ?? emptyBurn),
			...omitBy(newProps, isUndefined) as Partial<IDissolveProps>,
		};
		instance.burnProps = settings;
		if (instance.burnFilter) {
			const {uniforms} = instance.burnFilter;
			uniforms.uBurn = settings.burn;
			uniforms.uChar = settings.char;
			uniforms.uHeat = settings.heat;
			uniforms.uSeed = settings.seed;
			uniforms.uTime = settings.time;
		}
		this.applyDisplayObjectProps(oldProps, newProps);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
