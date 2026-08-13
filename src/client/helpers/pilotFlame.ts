/**
 * Огнемёт на изготове: ровное тихое горение, пока за столом целятся (см.
 * gameController.syncAiming). Не звук события, а фон — он держится всё время
 * выбора цели и гаснет, как только цель выбрана или ход отменён.
 *
 * Синтез прямо в браузере, а не файл, как у прочих звуков, — по трём причинам.
 *
 * Первая: это единственный звук в игре, который зациклен и длится неизвестно
 * сколько. Кольцо из mp3 не сходится — кодек добавляет к записи молчание в
 * начале и в конце, и на каждом обороте петли оно слышно провалом.
 *
 * Вторая: горение — это шум, и шум незачем возить по сети. Файл на десяток
 * секунд весил бы больше самого рёва огнемёта, а здесь его нет вовсе.
 *
 * Третья: у шума кольцо сходится само. Соседние отсчёты в нём и так не связаны
 * друг с другом, поэтому стык буфера ничем не отличается от любого другого
 * места, а фильтры за ним его же и сглаживают.
 *
 * Сам огонь в игре тоже считается процедурно (см. pixiPrimitives/Fire.tsx), да и
 * рёв огнемёта синтезирован (scripts/genFlamethrowerSound.ts) — слои здесь те
 * же, только вместо струи под давлением горит запальник: тело огня внизу и
 * шипение газа наверху.
 */

type AudioContextCtor = new () => AudioContext;

// Длина шумового кольца. Секунды хватило бы по звуку, но на слух короткая петля
// шума начинает «дышать» с её же периодом — слышно, что это одно и то же место
// по кругу.
const noiseSec = 3;

// Тело огня: низ, на котором держится всё горение. Выше килогерца запальник
// начинает звучать шелестом бумаги, поэтому срез низкий.
const bodyHz = 340;
// Шипение газа: без него горелка звучит гулом в трубе, а не огнём. Его тут
// заметно меньше тела — это фитилёк, а не открытый клапан.
const hissFromHz = 2200;
const hissToHz = 6500;
const hissLevel = 0.35;
// Пламя дышит: медленная качка громкости низа. Без неё горение — ровное
// шипение магнитофона.
const breathHz = 0.8;
const breathDepth = 0.35;

// Зажигается и гаснет запальник не мгновенно: включённый рывком шум слышен
// щелчком, и гасить его надо тем же плавным движением.
const fadeInSec = 0.25;
const fadeOutSec = 0.3;

interface IFlame {
	context: AudioContext;
	source: AudioBufferSourceNode;
	gain: GainNode;
	breath: OscillatorNode;
}

let flame: IFlame | null = null;
// Контекст переживает отдельные запуски: заводить его на каждое прицеливание
// значит каждый раз просить у браузера звуковое устройство, а их число он
// ограничивает.
let context: AudioContext | null = null;

const getContext = (): AudioContext | null => {
	if (context) return context;
	if (typeof window === 'undefined') return null;
	const ctor: AudioContextCtor | undefined = window.AudioContext
		?? (window as unknown as {webkitAudioContext?: AudioContextCtor}).webkitAudioContext;
	if (!ctor) return null;
	try {
		context = new ctor();
	} catch (e) {
		console.warn('Flame audio init failed', e);
		return null;
	}
	return context;
};

let noise: AudioBuffer | null = null;

const getNoise = (ctx: AudioContext): AudioBuffer => {
	if (noise && noise.sampleRate === ctx.sampleRate) return noise;
	const buffer = ctx.createBuffer(1, Math.round(noiseSec * ctx.sampleRate), ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	noise = buffer;
	return buffer;
};

/**
 * Зажечь запальник и вывести его на заданную громкость. Повторный вызов, пока
 * он горит, только меняет громкость: прицеливание одно, и второго огня у ствола
 * не появляется.
 */
export const startPilotFlame = (volume: number): void => {
	if (flame) {
		setPilotFlameVolume(volume);
		return;
	}
	const ctx = getContext();
	if (!ctx) return;
	try {
		// Браузер держит звук выключенным, пока страницу не тронут. Целятся после
		// нажатия на карту, так что разрешение к этому моменту уже есть, но
		// контекст всё равно надо будить явно.
		if (ctx.state === 'suspended') void ctx.resume();

		const source = ctx.createBufferSource();
		source.buffer = getNoise(ctx);
		source.loop = true;

		const gain = ctx.createGain();
		gain.gain.value = 0;
		gain.connect(ctx.destination);

		const body = ctx.createBiquadFilter();
		body.type = 'lowpass';
		body.frequency.value = bodyHz;
		body.Q.value = 0.9;
		const bodyGain = ctx.createGain();
		bodyGain.gain.value = 1;
		source.connect(body);
		body.connect(bodyGain);
		bodyGain.connect(gain);

		const hissHigh = ctx.createBiquadFilter();
		hissHigh.type = 'highpass';
		hissHigh.frequency.value = hissFromHz;
		const hissLow = ctx.createBiquadFilter();
		hissLow.type = 'lowpass';
		hissLow.frequency.value = hissToHz;
		const hissGain = ctx.createGain();
		hissGain.gain.value = hissLevel;
		source.connect(hissHigh);
		hissHigh.connect(hissLow);
		hissLow.connect(hissGain);
		hissGain.connect(gain);

		// Качка идёт на добавку к единице, поэтому её и вешаем на сам параметр
		// громкости низа, а не в разрыв цепи.
		const breath = ctx.createOscillator();
		breath.frequency.value = breathHz;
		const breathGain = ctx.createGain();
		breathGain.gain.value = breathDepth;
		breath.connect(breathGain);
		breathGain.connect(bodyGain.gain);

		source.start();
		breath.start();
		flame = {context: ctx, source, gain, breath};
		setPilotFlameVolume(volume, fadeInSec);
	} catch (e) {
		console.warn('Flame start failed', e);
		flame = null;
	}
};

/** Ползунок громкости крутят и при горящем запальнике — он должен отзываться. */
export const setPilotFlameVolume = (volume: number, overSec = 0): void => {
	if (!flame) return;
	const {context: ctx, gain} = flame;
	const level = Math.min(1, Math.max(0, volume));
	const now = ctx.currentTime;
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(gain.gain.value, now);
	gain.gain.linearRampToValueAtTime(level, now + Math.max(0.01, overSec));
};

/** Прицелились или передумали — огонь у ствола гаснет. */
export const stopPilotFlame = (): void => {
	if (!flame) return;
	const {context: ctx, source, gain, breath} = flame;
	flame = null;
	try {
		const now = ctx.currentTime;
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.linearRampToValueAtTime(0, now + fadeOutSec);
		// Узлы держат устройство занятым и после того, как замолчали, поэтому
		// глушим их, а не оставляем на нулевой громкости.
		source.stop(now + fadeOutSec + 0.05);
		breath.stop(now + fadeOutSec + 0.05);
		source.onended = () => {
			source.disconnect();
			breath.disconnect();
			gain.disconnect();
		};
	} catch (e) {
		console.warn('Flame stop failed', e);
	}
};
