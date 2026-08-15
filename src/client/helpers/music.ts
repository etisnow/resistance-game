/**
 * Тема «Нечто»: фон везде, где партии нет — с открытия игры и до её начала, и
 * снова после развязки. Одна тема, выбранная случайно, играет в петле сколько
 * угодно долго; следующую берём только когда музыка встаёт заново, то есть от
 * партии к партии.
 *
 * Играется она через Web Audio, а не элементом <audio loop>, — ради самой петли.
 * У элемента кольцо не сходится: mp3 несёт в себе молчание от кодека (он добивает
 * запись до целого кадра с обоих концов), и браузер честно проигрывает его на
 * каждом обороте — слышно провалом. Той же бедой болел бы и запальник огнемёта,
 * поэтому он и синтезируется на месте (см. helpers/pilotFlame).
 *
 * Здесь запись распаковывается целиком, молчание с краёв ищется по самим
 * отсчётам, и петля кладётся ровно между ними: стык выходит отсчёт в отсчёт, без
 * паузы. Заодно это снимает и вторую беду элемента — задержку на перемотку в
 * конце: у Web Audio петля живёт внутри уже распакованного буфера, и перематывать
 * там нечего.
 *
 * Громкость сюда приходит готовой, из helpers/sounds: доли в сведении и ползунок
 * игрока — его дело, здесь только то, что звучит.
 */
import {getAudioContext, resumeAudio} from 'client/helpers/audioContext';
import nechtoTrack from 'client/resources/sound/nechto.mp3';
import mainTrack from 'client/resources/sound/nechto-main.mp3';
import chillTrack from 'client/resources/sound/nechto-chill.mp3'

/**
 * Ротация тем. Скачивается и распаковывается всегда ровно одна: три темы — это
 * под три мегабайта сжатыми и десятки распакованными, и держать их все разом
 * незачем, до второй партии доходит не каждый.
 */
const tracks = [nechtoTrack, mainTrack, chillTrack];
// Что играло в прошлый раз. −1 — ещё ничего: первую тему выбираем из всех.
let trackIndex = -1;

const takeTrack = (): string => {
	// Сдвиг на 1..n−1: одна и та же тема дважды подряд слышится не случайностью, а
	// поломкой, и «случайно» здесь значит «случайная из остальных».
	const shift = 1 + Math.floor(Math.random() * (tracks.length - 1));
	trackIndex = trackIndex < 0
		? Math.floor(Math.random() * tracks.length)
		: (trackIndex + shift) % tracks.length;
	return tracks[trackIndex] as string;
};

// Тише этого считаем молчанием кодека (−60 дБ). Порог низкий нарочно: настоящую
// тишину с краёв срезали ещё при сжатии, там же положены микрофейды на срезах
// (см. scripts/packMusic.ts). Здесь остаётся убрать только добавленное кодеком, не
// откусывая начала и конца самой записи.
const silenceLevel = 0.001;

/**
 * Где в распакованной записи начинается и кончается звук. Это и есть точки
 * петли: между ними музыка, за ними — молчание кодека.
 */
const findLoop = (buffer: AudioBuffer): {start: number; end: number} => {
	const channels: Float32Array[] = [];
	for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
		channels.push(buffer.getChannelData(channel));
	}
	const loudAt = (i: number): number => {
		let peak = 0;
		for (const data of channels) peak = Math.max(peak, Math.abs(data[i] ?? 0));
		return peak;
	};
	let from = 0;
	while (from < buffer.length && loudAt(from) < silenceLevel) from++;
	let to = buffer.length;
	while (to > from && loudAt(to - 1) < silenceLevel) to--;
	// Одна тишина — такого быть не должно, но крутить всё равно что-то надо.
	if (to <= from) return {start: 0, end: buffer.duration};
	return {start: from / buffer.sampleRate, end: to / buffer.sampleRate};
};

// Резать звук на полном ходу нельзя: оборванная посреди волны тема щёлкает.
// Треть секунды — это уже не слышно щелчком и ещё не тянется хвостом за начавшейся
// партией.
const fadeOutSec = 0.35;
// Ползунок громкости ведём тем же коротким скатом: заданная рывком громкость
// шуршит на переходе.
const volumeRampSec = 0.05;

interface IPlaying {
	context: AudioContext;
	source: AudioBufferSourceNode;
	gain: GainNode;
}

let playing: IPlaying | null = null;
// Тема сейчас должна звучать. Не то же самое, что «звучит»: между «заводим» и
// «зазвучало» лежит загрузка, а до первого нажатия на страницу — ещё и молчащий
// контекст.
let isWanted = false;
// Номер текущей загрузки. Пока тема качается, партию могут начать — тогда
// распакованное приезжает уже некстати, и по номеру это видно.
let loadSeq = 0;
// Последнее, что сказали о громкости. Не в контексте, а здесь: заводя тему, её
// надо знать до того, как появится сам узел.
let volume = 0;

const load = async (url: string, context: AudioContext): Promise<AudioBuffer> => {
	const response = await fetch(url);
	const data = await response.arrayBuffer();
	return context.decodeAudioData(data);
};

const play = (context: AudioContext, buffer: AudioBuffer): void => {
	const {start, end} = findLoop(buffer);

	const gain = context.createGain();
	gain.gain.value = volume;
	gain.connect(context.destination);

	const source = context.createBufferSource();
	source.buffer = buffer;
	source.loop = true;
	source.loopStart = start;
	source.loopEnd = end;
	source.connect(gain);
	// С той же точки, где кольцо смыкается: до неё лежит молчание кодека, и
	// начинать с него значило бы услышать провал ещё до первого оборота.
	source.start(0, start);

	playing = {context, source, gain};
	resumeAudio();
};

/**
 * Заводит тему. Зовут это отовсюду, где партии сейчас нет: со старта приложения,
 * после развязки и на выходе со стола. Уже играющую не трогаем — иначе выход в
 * лобби перебивал бы её на начало, — а вот громкость принимаем всегда: ползунок
 * могли покрутить и до того.
 */
export const startMusic = (level: number): void => {
	setMusicVolume(level);
	if (isWanted) return;
	isWanted = true;
	const context = getAudioContext();
	if (!context) return;
	const seq = ++loadSeq;
	void load(takeTrack(), context)
		.then((buffer) => {
			// Пока качали и распаковывали, тему успели снять или завести заново.
			if (!isWanted || seq !== loadSeq) return;
			play(context, buffer);
		})
		.catch((e) => console.warn('Music load failed', e));
};

/** Началась партия — тема уходит: за столом звучит стол. */
export const stopMusic = (): void => {
	isWanted = false;
	// Незаконченная загрузка теперь ни к чему: пришедшее по ней играть уже нечему.
	loadSeq++;
	if (!playing) return;
	const {context, source, gain} = playing;
	playing = null;
	try {
		const now = context.currentTime;
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.linearRampToValueAtTime(0, now + fadeOutSec);
		// Узлы держат устройство занятым и после того, как замолчали, поэтому
		// глушим их, а не оставляем на нулевой громкости.
		source.stop(now + fadeOutSec + 0.05);
		source.onended = () => {
			source.disconnect();
			gain.disconnect();
		};
	} catch (e) {
		console.warn('Music stop failed', e);
	}
};

/** Ползунок громкости крутят и при играющей теме — она должна отзываться. */
export const setMusicVolume = (level: number): void => {
	volume = Math.min(1, Math.max(0, level));
	if (!playing) return;
	const {context, gain} = playing;
	const now = context.currentTime;
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(gain.gain.value, now);
	gain.gain.linearRampToValueAtTime(volume, now + volumeRampSec);
};
