/**
 * Вырезает из записи молотка первые три удара и кладёт их в звук карты
 * «Заколоченная дверь».
 *
 * Источник — sounds-raw/hammer-hammering-a-nail.wav (48 кГц, стерео). Синтезом
 * этот звук уже пробовали (было scripts/genBarricadeSound.ts), но настоящая
 * запись звучит живее любого набора затухающих синусов, так что от синтеза для
 * двери отказались.
 *
 * Удары скрипт находит сам, по огибающей: подбирать моменты среза на глаз —
 * значит переподбирать их заново после любой замены исходника. Правится звук
 * только исходником и константами ниже.
 *
 * Пересобрать (mp3 лежит под гитом, wav — рядом с ним, в sounds-raw):
 *
 *     bun run scripts/cutBarricadeSound.ts
 */
import {join} from 'path';
import {writeMp3} from './soundKit';

const ROOT = join(import.meta.dir, '..');
const IN = join(ROOT, 'sounds-raw/hammer-hammering-a-nail.wav');
const OUT = join(ROOT, 'src/client/resources/sound/barricade.mp3');

const BITRATE = 128;
// Сколько ударов берём.
const STRIKES = 3;
// Огибающую считаем окнами по 5 мс: короче — она дрожит на самом шуме, длиннее —
// смазывает атаку удара, а нам нужен именно её фронт.
const HOP_SEC = 0.005;
// Удар начался, если громкость перешла эту долю от самой громкой точки записи.
const ONSET_LEVEL = 0.18;
// Ближе этого удары считаем одним: у молотка между ударами четверть секунды, а
// внутри одного удара громкость дёргается не раз.
const MIN_GAP_SEC = 0.1;
// Запас перед первым ударом: срезать ровно по фронту нельзя, атака сама себя и
// обрежет.
const PRE_SEC = 0.012;
// Хвост после третьего удара. Берём его весь, какой есть в записи: обрывать по
// затиханию бессмысленно — первым двум ударам она даёт дозвучать до следующего
// удара, почти четверть секунды, и обрезанный по порогу третий слышен куцым
// рядом с ними. Ограничивает хвост только следующий удар, до которого оставляем
// зазор: его атака в срез попасть не должна.
const TAIL_MAX_SEC = 0.35;
const NEXT_GUARD_SEC = 0.04;
const FADE_IN_SEC = 0.003;
const FADE_OUT_SEC = 0.03;
// Нормируем с запасом до потолка: перед mp3 он нужен, иначе кодек выдаёт пики
// выше единицы и они щёлкают.
const PEAK = 0.95;

interface IWav {
	rate: number;
	channels: number;
	// Уже сведённое в моно: играем мы моно, а стерео тут только удваивает вес.
	mono: Float32Array;
}

/**
 * Читает 16-битный PCM wav. Полноценный разбор RIFF, а не «пропустить 44 байта»:
 * в этом файле между заголовком и данными лежит ещё чанк LIST с метаданными, и
 * по фиксированному смещению мы читали бы его как звук.
 */
const readWav = (bytes: Uint8Array): IWav => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const tag = (offset: number): string => String.fromCharCode(...bytes.subarray(offset, offset + 4));
	if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Это не RIFF/WAVE');

	let channels = 0;
	let rate = 0;
	let bits = 0;
	let data: Uint8Array | null = null;

	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const id = tag(offset);
		const size = view.getUint32(offset + 4, true);
		const body = offset + 8;
		if (id === 'fmt ') {
			const format = view.getUint16(body, true);
			channels = view.getUint16(body + 2, true);
			rate = view.getUint32(body + 4, true);
			bits = view.getUint16(body + 14, true);
			if (format !== 1 || bits !== 16) throw new Error(`Ожидался PCM 16 бит, а тут формат ${format}, ${bits} бит`);
		} else if (id === 'data') {
			data = bytes.subarray(body, body + size);
		}
		// Чанки выровнены по чётному байту.
		offset = body + size + (size % 2);
	}
	if (!data || !channels || !rate) throw new Error('В файле нет fmt или data');

	const frames = Math.floor(data.length / (2 * channels));
	const mono = new Float32Array(frames);
	const samples = new DataView(data.buffer, data.byteOffset, data.byteLength);
	for (let i = 0; i < frames; i++) {
		let sum = 0;
		for (let c = 0; c < channels; c++) sum += samples.getInt16((i * channels + c) * 2, true) / 32768;
		mono[i] = sum / channels;
	}
	return {rate, channels, mono};
};

const wav = readWav(new Uint8Array(await Bun.file(IN).arrayBuffer()));
const {rate, mono} = wav;

// Огибающая по окнам.
const hop = Math.max(1, Math.round(HOP_SEC * rate));
const envelope = new Float32Array(Math.ceil(mono.length / hop));
envelope.forEach((_, k) => {
	let sum = 0;
	const from = k * hop;
	const to = Math.min(from + hop, mono.length);
	for (let i = from; i < to; i++) sum += (mono[i] ?? 0) ** 2;
	envelope[k] = Math.sqrt(sum / Math.max(1, to - from));
});
let envPeak = 0;
envelope.forEach(value => {
	envPeak = Math.max(envPeak, value);
});

// Начала ударов: переход огибающей через порог, не чаще одного на MIN_GAP_SEC.
const minGap = Math.round(MIN_GAP_SEC / HOP_SEC);
const onsets: number[] = [];
let last = -minGap;
envelope.forEach((value, k) => {
	if (value < ONSET_LEVEL * envPeak) return;
	if (k - last < minGap) return;
	last = k;
	onsets.push(k);
});
if (onsets.length < STRIKES) throw new Error(`Нашлось ударов: ${onsets.length}, а нужно ${STRIKES}`);

console.log(`Запись: ${(mono.length / rate).toFixed(2)} с, ${rate} Гц, ${wav.channels} канал(а)`);
console.log(`Удары найдены на: ${onsets.map(k => (k * HOP_SEC).toFixed(3)).join(', ')} с`
	+ (onsets.length > STRIKES ? ` (берём первые ${STRIKES})` : ''));

const firstOnset = onsets[0] ?? 0;
const lastOnset = onsets[STRIKES - 1] ?? 0;
const from = Math.max(0, Math.round((firstOnset * HOP_SEC - PRE_SEC) * rate));

// Конец: весь хвост третьего удара, но не дальше предела и не вплотную к
// четвёртому удару, если он в записи есть.
const nextOnset = onsets[STRIKES];
const end = Math.min(
	lastOnset * HOP_SEC + TAIL_MAX_SEC,
	nextOnset === undefined ? mono.length / rate : nextOnset * HOP_SEC - NEXT_GUARD_SEC,
);
const to = Math.min(mono.length, Math.round(end * rate));

const cut = mono.slice(from, to);
let peak = 0;
cut.forEach(value => {
	peak = Math.max(peak, Math.abs(value));
});
const gain = peak > 0 ? PEAK / peak : 1;
const fadeIn = Math.max(1, Math.round(FADE_IN_SEC * rate));
const fadeOut = Math.max(1, Math.round(FADE_OUT_SEC * rate));

const pcm = new Int16Array(cut.length);
cut.forEach((value, i) => {
	// Края обязаны сойтись в ноль: срез посреди звука слышен как щелчок.
	const fade = Math.min(1, i / fadeIn, (cut.length - i) / fadeOut);
	pcm[i] = Math.round(Math.max(-1, Math.min(1, value * gain * fade)) * 32767);
});

const seconds = cut.length / rate;
console.log(`Вырезано ${(from / rate).toFixed(3)}–${(to / rate).toFixed(3)} с (${seconds.toFixed(2)} с),`
	+ ` усиление ${gain.toFixed(2)}x`);

const bytes = await writeMp3(OUT, pcm, BITRATE, rate);
console.log(`Barricade sound -> ${OUT} (${seconds.toFixed(2)}s, ${(bytes / 1024).toFixed(1)} KB)`);
