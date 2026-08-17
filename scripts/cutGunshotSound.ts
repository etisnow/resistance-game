/**
 * Срезает у выстрела тишину в начале.
 *
 * Запись из стока (sounds-raw/magnum-shot.mp3) начинается с трети секунды
 * ровного нуля, и только потом бьёт сам выстрел. В игре это слышно как задержку:
 * Убийца нажал — и треть секунды ничего. А выстрел должен совпасть с нажатием,
 * иначе он не выстрел, а отзвук.
 *
 * Поэтому отдельный скрипт, а не строчка в importRawSounds: тот только копирует
 * и срезает метаданные (см. его шапку), а здесь запись разбирается и режется.
 * Выстрел из его списка ради этого убран — иначе следующий его запуск вернул бы
 * файл с тишиной.
 *
 * Место среза скрипт находит сам, по самой записи: искать его глазами — значит
 * искать заново после любой замены исходника.
 *
 *     bun run scripts/cutGunshotSound.ts
 */
import {MPEGDecoder} from 'mpg123-decoder';
import {Mp3Encoder} from '@breezystack/lamejs';
import {join} from 'path';

const ROOT = join(import.meta.dir, '..');
const IN = join(ROOT, 'sounds-raw/magnum-shot.mp3');
const OUT = join(ROOT, 'src/client/resources/sound/gunshot.mp3');

// Как в исходнике: перекодировать приходится (иначе не отрезать), и хотя бы
// битрейт ронять не будем.
const BITRATE = 128;
// Огибающую считаем окнами по 5 мс: выстрел — это удар, и начало у него резкое.
// Окно длиннее размазало бы его по тишине перед ним.
const HOP_SEC = 0.005;
// Насколько тише пика может быть окно, чтобы всё ещё считаться тишиной. −40 дБ:
// на этом уровне в записи ещё нет звука, а есть подрагивание перед атакой —
// слышно его не будет, но и резать по нему нечего.
const SILENCE_UNDER_PEAK_DB = -40;
// Сколько оставляем перед первым звучащим окном. Совсем без разбега выстрел
// начинается прямо с пика, и это слышно как обрубок, а не как удар.
const PRE_ROLL_SEC = 0.01;
// Нарастание на срезе. Короткое — иначе съело бы саму атаку, ради которой всё и
// делается; его задача только убрать щелчок обрыва.
const FADE_IN_SEC = 0.002;

const source = new Uint8Array(await Bun.file(IN).arrayBuffer());
const decoder = new MPEGDecoder();
await decoder.ready;
const {channelData, samplesDecoded, sampleRate, errors} = decoder.decode(source);
decoder.free();
if (errors.length) console.warn(`Декодер ругнулся ${errors.length} раз(а)`);
const left = channelData[0];
if (!left || !samplesDecoded) throw new Error('Запись не декодировалась');
const right = channelData[1] ?? left;
const channels = channelData.length > 1 ? 2 : 1;

/** Громкость куска записи по обоим каналам сразу. */
const rms = (from: number, to: number): number => {
	let sum = 0;
	for (let i = from; i < to; i++) sum += ((left[i] ?? 0) ** 2 + (right[i] ?? 0) ** 2) / 2;
	return Math.sqrt(sum / Math.max(1, to - from));
};

let peak = 0;
for (let i = 0; i < samplesDecoded; i++) {
	peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
}
const threshold = peak * 10 ** (SILENCE_UNDER_PEAK_DB / 20);

// Первое окно, которое громче порога. Идём с начала: там тишина, и кончается
// она ровно один раз.
const hop = Math.max(1, Math.round(HOP_SEC * sampleRate));
const windows = Math.ceil(samplesDecoded / hop);
let first = 0;
while (first < windows - 1 && rms(first * hop, Math.min((first + 1) * hop, samplesDecoded)) < threshold) first++;

const preRoll = Math.round(PRE_ROLL_SEC * sampleRate);
const fade = Math.max(1, Math.round(FADE_IN_SEC * sampleRate));

const encode = (start: number): Uint8Array => {
	const length = samplesDecoded - start;
	const pcm = (data: Float32Array): Int16Array => {
		const out = new Int16Array(length);
		for (let i = 0; i < length; i++) {
			const value = (data[start + i] ?? 0) * Math.min(1, i / fade);
			out[i] = Math.round(Math.max(-1, Math.min(1, value)) * 32767);
		}
		return out;
	};
	const leftPcm = pcm(left);
	const rightPcm = channels > 1 ? pcm(right) : leftPcm;

	const encoder = new Mp3Encoder(channels, sampleRate, BITRATE);
	const chunks: Uint8Array[] = [];
	for (let i = 0; i < length; i += 1152) {
		const end = Math.min(i + 1152, length);
		const chunk = channels > 1
			? encoder.encodeBuffer(leftPcm.subarray(i, end), rightPcm.subarray(i, end))
			: encoder.encodeBuffer(leftPcm.subarray(i, end));
		if (chunk.length) chunks.push(chunk);
	}
	const rest = encoder.flush();
	if (rest.length) chunks.push(rest);

	const out = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
};

/** С какого сэмпла в готовом файле начинается звук — по тому же порогу. */
const soundStartsAt = async (mp3: Uint8Array): Promise<number> => {
	const check = new MPEGDecoder();
	await check.ready;
	const decoded = check.decode(mp3);
	check.free();
	const l = decoded.channelData[0];
	if (!l) return 0;
	const r = decoded.channelData[1] ?? l;
	let at = 0;
	while (at + hop < decoded.samplesDecoded) {
		let sum = 0;
		for (let i = at; i < at + hop; i++) sum += ((l[i] ?? 0) ** 2 + (r[i] ?? 0) ** 2) / 2;
		if (Math.sqrt(sum / hop) >= threshold) return at;
		at += hop;
	}
	return 0;
};

let start = Math.max(0, first * hop - preRoll);
let mp3 = encode(start);
// Сам mp3 добавляет тишину: у кодировщика своя задержка в несколько сотен
// сэмплов, и в готовом файле звук снова начинается не сразу. Величина эта
// постоянная, но зависит от библиотеки, поэтому не вписываем её числом, а
// измеряем по результату и один раз компенсируем.
const codecDelay = await soundStartsAt(mp3);
if (codecDelay > preRoll) {
	start = Math.min(samplesDecoded - 1, start + codecDelay - preRoll);
	mp3 = encode(start);
}
await Bun.write(OUT, mp3);

const db = (value: number): string => (20 * Math.log10(value || 1e-9)).toFixed(1);
console.log(`Запись: ${(samplesDecoded / sampleRate).toFixed(2)} с, ${sampleRate} Гц,`
	+ ` ${channels === 1 ? 'моно' : 'стерео'}, пик ${db(peak)} дБ`);
console.log(`magnum-shot.mp3 -> ${OUT}: ${((samplesDecoded - start) / sampleRate).toFixed(2)} с`
	+ ` (срезано ${(start / sampleRate * 1000).toFixed(0)} мс тишины,`
	+ ` из них ${(Math.max(0, codecDelay - preRoll) / sampleRate * 1000).toFixed(0)} мс — задержка кодировщика),`
	+ ` ${(source.length / 1024).toFixed(1)} КБ -> ${(mp3.length / 1024).toFixed(1)} КБ`);
console.log(`Звук начинается через ${(await soundStartsAt(mp3) / sampleRate * 1000).toFixed(0)} мс от начала файла`);
