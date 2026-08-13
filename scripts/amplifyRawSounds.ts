/**
 * Усиливает записи, которым не хватает громкости в самой игре.
 *
 * Доля в sounds.ts может только приглушать: единица там — это уровень записи, а
 * громче записи звук не сделать (см. createSound). Тихую запись поэтому
 * приходится усиливать в самом файле — здесь.
 *
 * Отдельно от importRawSounds по той же причине, по какой отдельно живёт
 * cutPanicSound: тот только копирует и срезает метаданные, а здесь запись
 * пересобирается. Усиленные звуки из его списка убраны — иначе следующий его
 * запуск вернул бы тихий файл.
 *
 * Усиление считается от исходника в sounds-raw, а не от того, что уже лежит в
 * ассетах: скрипт можно гонять сколько угодно раз, и множитель в таблице значит
 * одно и то же — во столько раз громче оригинала.
 *
 *     bun run scripts/amplifyRawSounds.ts
 */
import {MPEGDecoder} from 'mpg123-decoder';
import {Mp3Encoder} from '@breezystack/lamejs';
import {join} from 'path';

const ROOT = join(import.meta.dir, '..');
const RAW = join(ROOT, 'sounds-raw');
const SOUND = join(ROOT, 'src/client/resources/sound');

const BITRATE = 128;
// Выше этого пика не поднимаемся: перед mp3 нужен запас, иначе кодек выдаёт
// пики выше единицы и они щёлкают.
const PEAK = 0.95;

const sounds: {from: string; to: string; gain: number}[] = [
	// «Анализ» — набирают пробирку. Запись самая тихая в наборе (−29.5 дБ по
	// самому громкому отрезку в 300 мс против −17 у обычных карт), и в игре её
	// не слышно за столом. Запас до потолка у неё огромный (пик 0.28), так что
	// усиление ничего не режет.
	{from: 'jidkost-nabiraetsya-s-puzyirkami.mp3', to: 'analysis.mp3', gain: 1.4},
];

for (const {from, to, gain} of sounds) {
	const source = new Uint8Array(await Bun.file(join(RAW, from)).arrayBuffer());

	const decoder = new MPEGDecoder();
	await decoder.ready;
	const {channelData, samplesDecoded, sampleRate, errors} = decoder.decode(source);
	decoder.free();
	if (errors.length) console.warn(`${from}: декодер ругнулся ${errors.length} раз(а)`);
	const left = channelData[0];
	if (!left || !samplesDecoded) throw new Error(`${from}: не декодировался`);
	const right = channelData[1] ?? left;
	const channels = channelData.length > 1 ? 2 : 1;

	let peak = 0;
	for (let i = 0; i < samplesDecoded; i++) {
		peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
	}
	// Если запрошенное усиление упирается в потолок, режем не сигнал, а само
	// усиление: обрезанные пики слышны хрустом, и молча выдавать их за
	// «погромче» нельзя.
	const applied = Math.min(gain, peak > 0 ? PEAK / peak : gain);
	if (applied < gain) {
		console.warn(`${from}: усиление ${gain.toFixed(2)}x упирается в потолок,`
			+ ` берём ${applied.toFixed(2)}x (пик записи ${peak.toFixed(3)})`);
	}

	const pcm = (data: Float32Array): Int16Array => {
		const out = new Int16Array(samplesDecoded);
		for (let i = 0; i < samplesDecoded; i++) {
			out[i] = Math.round(Math.max(-1, Math.min(1, (data[i] ?? 0) * applied)) * 32767);
		}
		return out;
	};
	const leftPcm = pcm(left);
	const rightPcm = channels > 1 ? pcm(right) : leftPcm;

	const encoder = new Mp3Encoder(channels, sampleRate, BITRATE);
	const chunks: Uint8Array[] = [];
	for (let i = 0; i < samplesDecoded; i += 1152) {
		const end = Math.min(i + 1152, samplesDecoded);
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
	await Bun.write(join(SOUND, to), mp3);

	console.log(`${from} -> ${to}: ${(samplesDecoded / sampleRate).toFixed(2)} с, ${sampleRate} Гц,`
		+ ` ${channels === 1 ? 'моно' : 'стерео'}, усиление ${applied.toFixed(2)}x`
		+ ` (+${(20 * Math.log10(applied)).toFixed(1)} дБ), пик ${(peak * applied).toFixed(3)},`
		+ ` ${(mp3.length / 1024).toFixed(1)} КБ`);
}
