/**
 * Общая часть генераторов звука (genFlamethrowerSound, genBarricadeSound):
 * шум, фильтры, мастер-цепочка и запись mp3.
 *
 * Звуки в игре не записаны, а синтезированы — как и огонь, который считает
 * шейдер. Отличаются они слоями и расписанием, а вот основание у всех одно, и
 * держать его в одном месте дешевле, чем сверять копии между скриптами.
 */
import {Mp3Encoder} from '@breezystack/lamejs';

export const RATE = 44100;

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Тот же smoothstep, что в шейдерах: огибающие звука и картинки должны совпадать
// не приблизительно, а формулой.
export const smoothstep = (edge0: number, edge1: number, value: number): number => {
	const t = clamp01((value - edge0) / (edge1 - edge0 || 1));
	return t * t * (3 - 2 * t);
};

export interface INoise {
	// Равномерное 0..1.
	random(): number;
	// Белый шум −1..1 — исходный материал почти для всего.
	white(): number;
	// Плавный случайный сигнал 0..1 с заданной частотой обновления: тот же приём,
	// что fbm в шейдере, только в одно измерение. Им живёт всё, что должно
	// «дышать», — турбулентность пламени, подвальный гул, дрожь.
	wobble(rateHz: number): () => number;
}

/**
 * Детерминированный шум (mulberry32). Один и тот же запуск скрипта обязан давать
 * один и тот же файл: иначе каждая перегенерация — новый бинарник в диффе, и по
 * истории не понять, менялся ли звук на самом деле.
 */
export const createNoise = (seed: number): INoise => {
	let state = seed >>> 0;
	const random = (): number => {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const white = (): number => random() * 2 - 1;
	const wobble = (rateHz: number): (() => number) => {
		let prev = random();
		let next = random();
		let phase = 0;
		const step = rateHz / RATE;
		return () => {
			phase += step;
			while (phase >= 1) {
				phase -= 1;
				prev = next;
				next = random();
			}
			const t = phase * phase * (3 - 2 * phase);
			return prev + (next - prev) * t;
		};
	};
	return {random, white, wobble};
};

/**
 * Биквад (RBJ cookbook). Коэффициенты можно пересчитывать на ходу: у струи и
 * костра частота среза всё время плывёт — без этого поток звучит как ровное
 * шипение магнитофона, а не как пламя.
 */
export class Biquad {
	private b0 = 1;
	private b1 = 0;
	private b2 = 0;
	private a1 = 0;
	private a2 = 0;
	private x1 = 0;
	private x2 = 0;
	private y1 = 0;
	private y2 = 0;

	private set(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number) {
		this.b0 = b0 / a0;
		this.b1 = b1 / a0;
		this.b2 = b2 / a0;
		this.a1 = a1 / a0;
		this.a2 = a2 / a0;
	}

	lowpass(freq: number, q: number): Biquad {
		const w = 2 * Math.PI * Math.min(freq, RATE * 0.45) / RATE;
		const cos = Math.cos(w);
		const alpha = Math.sin(w) / (2 * q);
		this.set((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
		return this;
	}

	highpass(freq: number, q: number): Biquad {
		const w = 2 * Math.PI * Math.min(freq, RATE * 0.45) / RATE;
		const cos = Math.cos(w);
		const alpha = Math.sin(w) / (2 * q);
		this.set((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
		return this;
	}

	bandpass(freq: number, q: number): Biquad {
		const w = 2 * Math.PI * Math.min(freq, RATE * 0.45) / RATE;
		const cos = Math.cos(w);
		const alpha = Math.sin(w) / (2 * q);
		this.set(alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha);
		return this;
	}

	process(x: number): number {
		const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
		this.x2 = this.x1;
		this.x1 = x;
		this.y2 = this.y1;
		this.y1 = y;
		return y;
	}
}

export interface IMasterOptions {
	// Ниже этой частоты режем: там остаётся один ход диффузора впустую, а на
	// телефоне — дребезг.
	dcCutHz: number;
	// Мягкое ограничение. Пики иначе режутся квадратом — это слышно как хруст.
	drive: number;
	// Нормируем не в самый потолок: перед mp3 нужен запас, иначе кодек выдаёт
	// пики выше единицы и они щёлкают при воспроизведении.
	peak: number;
	fadeInSec: number;
	fadeOutSec: number;
}

/** Мастер-цепочка: срез низа, ограничение, нормировка, края — и в 16 бит. */
export const master = (samples: Float32Array, options: IMasterOptions): Int16Array => {
	const {dcCutHz, drive, peak: target, fadeInSec, fadeOutSec} = options;
	const dcCut = new Biquad().highpass(dcCutHz, 0.7);
	samples.forEach((value, i) => {
		samples[i] = Math.tanh(dcCut.process(value) * drive);
	});

	let peak = 0;
	samples.forEach(value => {
		peak = Math.max(peak, Math.abs(value));
	});
	const gain = peak > 0 ? target / peak : 1;
	const fadeIn = Math.round(fadeInSec * RATE);
	const fadeOut = Math.round(fadeOutSec * RATE);

	const pcm = new Int16Array(samples.length);
	samples.forEach((value, i) => {
		const fade = Math.min(1, i / fadeIn, (samples.length - i) / fadeOut);
		pcm[i] = Math.round(Math.max(-1, Math.min(1, value * gain * fade)) * 32767);
	});
	return pcm;
};

/**
 * Огибающая готового звука столбиками. Смотреть на неё стоит после каждой
 * правки: то, что в звуке должно читаться (удар, разгон, спад), обязано
 * читаться и здесь.
 */
export const printEnvelope = (pcm: Int16Array, barSec: number, scale = 90) => {
	const bar = Math.round(barSec * RATE);
	console.log(`Огибающая (${barSec} с на строку):`);
	for (let i = 0; i < pcm.length; i += bar) {
		let rms = 0;
		const end = Math.min(i + bar, pcm.length);
		for (let k = i; k < end; k++) rms += (pcm[k] ?? 0) ** 2;
		rms = Math.sqrt(rms / (end - i)) / 32767;
		console.log(`${(i / RATE).toFixed(2).padStart(5)}s ${'#'.repeat(Math.round(rms * scale))}`);
	}
};

/**
 * Пишет моно-mp3. Возвращает размер файла в байтах. Частоту можно задать: у
 * синтезированных звуков она наша, а у нарезанных из записи — та, что в исходнике
 * (пересчёт частоты испортил бы запись без всякой нужды).
 */
export const writeMp3 = async (path: string, pcm: Int16Array, bitrate: number, rate = RATE): Promise<number> => {
	const encoder = new Mp3Encoder(1, rate, bitrate);
	const chunks: Uint8Array[] = [];
	// Кодек считает кадрами по 1152 сэмпла — кусками другого размера кормить его
	// можно, но lame тогда буферизует их сам, без всякой пользы.
	for (let i = 0; i < pcm.length; i += 1152) {
		const chunk = encoder.encodeBuffer(pcm.subarray(i, Math.min(i + 1152, pcm.length)));
		if (chunk.length) chunks.push(chunk);
	}
	const rest = encoder.flush();
	if (rest.length) chunks.push(rest);

	const mp3 = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		mp3.set(chunk, offset);
		offset += chunk.length;
	}
	await Bun.write(path, mp3);
	return mp3.length;
};
