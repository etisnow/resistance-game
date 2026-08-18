/**
 * Пережимает музыкальные треки из sounds-raw в ассеты клиента.
 *
 * Отдельно от importRawSounds, который только копирует и срезает метаданные:
 * музыка — это минуты звука против секунды у эффектов, и её вес решает не тег с
 * обложкой, а битрейт. Исходники сведены под прослушивание (VBR около 270
 * кбит/с, по 2 МБ на тему) — для фона в браузерной игре это впустую скачанные
 * мегабайты.
 *
 * Заодно с краёв срезается тишина: трек играет по кругу, и лишняя доля секунды
 * молчания в конце слышна на стыке как провал.
 *
 *     bun run scripts/packMusic.ts
 */
import {MPEGDecoder} from 'mpg123-decoder';
import {Mp3Encoder} from '@breezystack/lamejs';
import {join} from 'path';

const ROOT = join(import.meta.dir, '..');
const RAW = join(ROOT, 'sounds-raw');
const SOUND = join(ROOT, 'src/client/resources/sound');

// 112 кбит/с: на фоновой музыке под игру разницы с исходными 270 не слышно, а
// весит она вдвое с лишним меньше. Ниже 96 уже слышно на тарелках и реверберации.
const BITRATE = 112;
// Тише этого края считаем тишиной (−45 дБ).
const SILENCE = 0.0056;
// Микрофейды на срезах: без них склейка щёлкает, а длиннее — слышно как провал
// в петле.
const FADE_SEC = 0.005;

// Весь список тем: в игре они идут вперемешку (см. helpers/music), и жать их
// надо одинаково — иначе на стыке между темами слышно, что одна другой громче
// или глуше.
const tracks: {from: string; to: string}[] = [
	{from: 'resistance-main.mp3', to: 'resistance-main.mp3'},
	{from: 'resistance-main-2.mp3', to: 'resistance-main-2.mp3'},
];

for (const {from, to} of tracks) {
	const source = new Uint8Array(await Bun.file(join(RAW, from)).arrayBuffer());

	const decoder = new MPEGDecoder();
	await decoder.ready;
	const {channelData, samplesDecoded, sampleRate, errors} = decoder.decode(source);
	decoder.free();
	if (errors.length) console.warn(`${from}: декодер ругнулся ${errors.length} раз(а)`);
	const left = channelData[0];
	if (!left || !samplesDecoded) throw new Error(`${from}: не декодировался`);
	// Моно-исходник кодируем как моно: дублировать канал ради «стерео» — значит
	// платить битрейтом за ровно ту же дорожку дважды.
	const right = channelData[1] ?? left;
	const channels = channelData.length > 1 ? 2 : 1;

	// Края тишины ищем по громкости обоих каналов сразу.
	const loudAt = (i: number): number => Math.max(Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
	let from0 = 0;
	while (from0 < samplesDecoded && loudAt(from0) < SILENCE) from0++;
	let to0 = samplesDecoded;
	while (to0 > from0 && loudAt(to0 - 1) < SILENCE) to0--;
	const length = to0 - from0;
	if (length <= 0) throw new Error(`${from}: одна тишина`);

	const fade = Math.max(1, Math.round(FADE_SEC * sampleRate));
	const pcm = (data: Float32Array): Int16Array => {
		const out = new Int16Array(length);
		for (let i = 0; i < length; i++) {
			const shape = Math.min(1, i / fade, (length - i) / fade);
			const value = (data[from0 + i] ?? 0) * shape;
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
	await Bun.write(join(SOUND, to), mp3);

	const trimmed = (samplesDecoded - length) / sampleRate;
	console.log(`${from} -> ${to}: ${(length / sampleRate).toFixed(2)} с, ${sampleRate} Гц,`
		+ ` ${channels === 1 ? 'моно' : 'стерео'}, ${BITRATE} кбит/с`
		+ ` | ${(source.length / 1024 / 1024).toFixed(2)} МБ -> ${(mp3.length / 1024).toFixed(0)} КБ`
		+ ` (−${Math.round((1 - mp3.length / source.length) * 100)}%)`
		+ (trimmed > 0.01 ? `, тишины срезано ${trimmed.toFixed(2)} с` : ''));
}
