/**
 * Срезает у звука паники хвост с белым шумом.
 *
 * Запись из стока (sounds-raw/panic.mp3) длиной десять секунд, но сам звук
 * кончается на четвёртой: дальше до самого конца тянется ровная шумовая полка
 * −62 дБ — шум микрофона, оставленный в исходнике. В игре это слышно как
 * шипение после события и мешает: паника звучит на весь стол, и следом за ней
 * шесть секунд подряд шипит.
 *
 * Поэтому отдельный скрипт, а не строчка в importRawSounds: тот только копирует
 * и срезает метаданные (см. его шапку), а здесь запись разбирается и режется.
 * Панику из его списка ради этого убрали — иначе следующий его запуск вернул бы
 * файл с хвостом.
 *
 * Место среза скрипт находит сам: полку он измеряет по концу записи, а звуком
 * считает всё, что её громче. Подбирать секунду на глаз — значит подбирать её
 * заново после любой замены исходника.
 *
 *     bun run scripts/cutPanicSound.ts
 */
import {MPEGDecoder} from 'mpg123-decoder';
import {Mp3Encoder} from '@breezystack/lamejs';
import {join} from 'path';

const ROOT = join(import.meta.dir, '..');
const IN = join(ROOT, 'sounds-raw/panic.mp3');
const OUT = join(ROOT, 'src/client/resources/sound/panic.mp3');

// Как в исходнике: перекодировать приходится (иначе не отрезать), и хотя бы
// битрейт ронять не будем.
const BITRATE = 128;
// Огибающую считаем окнами по 50 мс: хвост ищем на слуховой шкале, а не по
// отдельным сэмплам — одиночный всплеск шума это не звук.
const HOP_SEC = 0.05;
// Полку меряем по последней секунде: там заведомо один шум.
const FLOOR_SEC = 1;
// Насколько окно должно быть громче полки, чтобы считаться звуком. 6 дБ — вдвое:
// сам шум так не скачет, а затухающий хвост события ещё слышен.
const OVER_FLOOR_DB = 6;
// Сколько шума оставляем после последнего звучащего окна: затухание должно
// дойти до тишины само, а не упереться в срез.
const TAIL_SEC = 0.15;
// Затухание на срезе. Длинное: короткое на шуме слышно как щелчок обрыва, а
// такое сходит за естественный конец затухания.
const FADE_OUT_SEC = 0.1;

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

const hop = Math.max(1, Math.round(HOP_SEC * sampleRate));
const floor = rms(Math.max(0, samplesDecoded - Math.round(FLOOR_SEC * sampleRate)), samplesDecoded);
const threshold = floor * 10 ** (OVER_FLOOR_DB / 20);

// Последнее окно, которое ещё громче полки. Ищем с конца: в начале записи
// громче полки вообще всё, и идти оттуда незачем.
let last = Math.ceil(samplesDecoded / hop) - 1;
while (last > 0 && rms(last * hop, Math.min((last + 1) * hop, samplesDecoded)) < threshold) last--;

const length = Math.min(samplesDecoded, Math.round((last + 1) * HOP_SEC * sampleRate + TAIL_SEC * sampleRate));
const fade = Math.max(1, Math.round(FADE_OUT_SEC * sampleRate));

const pcm = (data: Float32Array): Int16Array => {
	const out = new Int16Array(length);
	for (let i = 0; i < length; i++) {
		const value = (data[i] ?? 0) * Math.min(1, (length - i) / fade);
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

const mp3 = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
let offset = 0;
for (const chunk of chunks) {
	mp3.set(chunk, offset);
	offset += chunk.length;
}
await Bun.write(OUT, mp3);

const db = (value: number): string => (20 * Math.log10(value || 1e-9)).toFixed(1);
console.log(`Запись: ${(samplesDecoded / sampleRate).toFixed(2)} с, ${sampleRate} Гц,`
	+ ` ${channels === 1 ? 'моно' : 'стерео'}, шумовая полка ${db(floor)} дБ`);
console.log(`panic.mp3 -> ${OUT}: ${(length / sampleRate).toFixed(2)} с`
	+ ` (срезано ${((samplesDecoded - length) / sampleRate).toFixed(2)} с шума),`
	+ ` ${(source.length / 1024).toFixed(1)} КБ -> ${(mp3.length / 1024).toFixed(1)} КБ`);
