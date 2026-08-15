import UIfxImport from 'uifx';
import bellAudio from 'client/resources/sound/beep.mp3';
import paperAudio from 'client/resources/sound/paper.mp3';
import spiesWinAudio from 'client/resources/sound/thingWin.mp3';
import spiesLoseAudio from 'client/resources/sound/thingLose.mp3';
import {setMusicVolume, startMusic as igniteMusic, stopMusic} from 'client/helpers/music';

// TODO (фаза 3): звуки голосования, вскрытия и развязки. Пока развязка звучит
// записями «Нечто» — свой набор появится вместе с визуальным стилем.

// uifx собран как UMD, и сборщики разворачивают его по-разному: vite кладёт в
// default весь module.exports, а сам класс — внутрь, в .default. Без этой
// развёртки `new UIfx(...)` падает с «UIfx is not a constructor», падение съедает
// catch ниже, и звука в игре просто нет — молча, как было с гонгом хода.
const UIfx = (UIfxImport as unknown as {default?: typeof UIfxImport}).default ?? UIfxImport;

// Ползунки игрока. Владеет ими SoundController — он их и хранит, и отдаёт
// столу; здесь лежит только последнее, что он сюда положил.
//
// Копия, а не чтение из mobx: play() зовут из середины анимации и по многу раз
// за ход, и ходить за громкостью в наблюдаемое состояние оттуда незачем — сам
// звук на него не реагирует, он берёт уровень один раз, в момент запуска.
//
// Единица до первого applySoundVolume — не «по умолчанию громко», а «контроллер
// ещё не сказал»: он говорит в своём конструкторе, до первого звука в игре.
let soundLevel = 1;
let musicLevel = 1;

// Весь набор оказался громче нужного: выровнен он между собой верно, а вот
// уровнем целиком садится на уши — за партию звуков много, и слушать их час
// подряд на прежней громкости тяжело. Поэтому общий множитель, а не правка
// долей у каждого звука: доли выверены друг относительно друга по замерам, и
// трогать их — значит ломать баланс ради одного лишь уровня.
//
// 0.6 — это −40% от прежнего, примерно −4.4 дБ.
const masterGain = 0.6;

/** Итоговая громкость звука: своя доля, ползунок игрока и общий множитель. */
const mix = (volume: number): number => Math.min(1, Math.max(0, volume * soundLevel * masterGain));

/**
 * То же для музыки, но от своего ползунка. Общий множитель тот же: он срезает
 * уровень всей игры разом, и музыка из него не выделена — иначе, убавив набор,
 * мы бы ровно на столько же выпятили тему над ним.
 */
const mixMusic = (): number => Math.min(1, Math.max(0, musicBaseVolume * musicLevel * masterGain));

/**
 * Звуки стола встали на новый уровень. 0 — полная тишина, 1 — как задумано.
 *
 * Зовёт это только SoundController: здесь уровень не хранят и не сохраняют, а
 * доносят до тех, кто уже звучит.
 */
export const applySoundVolume = (value: number): void => {
	soundLevel = value;
};

/** То же для музыки: тема, в отличие от звуков, уже играет — ей отзываемся сразу. */
export const applyMusicVolume = (value: number): void => {
	musicLevel = value;
	setMusicVolume(mixMusic());
};

// Звук — дело неглавное: если браузер не дал завести Audio (а он не даёт,
// например, из-под некоторых политик безопасности), игра всё равно обязана
// подняться. Поэтому неудачная инициализация вырождается в пустышку, а не в
// исключение на старте модуля.
//
// Громкость передаётся в каждый play, а не задаётся один раз при создании:
// ползунок в меню крутит все звуки разом, а собственная доля у каждого своя.
//
// Единица — уровень самой записи, громче не бывает: усилить запись отсюда
// нельзя, только приглушить. Поэтому доли ниже — это выравнивание сверху.
// Считаны они не на глаз, а по самим файлам. Если правишь — правь после замера,
// иначе один звук снова перекричит стол.
const createSound = (file: string, volume: number, throttleMs: number): (() => void) => {
	try {
		const sound = new UIfx(file, {volume, throttleMs});
		return () => sound.play(mix(volume));
	} catch (e) {
		console.warn('Sound init failed', e);
		return () => undefined;
	}
};

// Гонг: он зовёт к столу, поэтому должен быть слышен, но звучит часто и громким
// быстро надоедает. Сама запись тихая (−22 дБ), так что приглушать её почти не
// приходится.
export const playBell = createSound(bellAudio, 0.75, 100);

/**
 * Шелест бумаги. Throttle совсем короткий, только чтобы карты, вскрываемые всем
 * столом разом, не зашелестели хором.
 */
export const playPaper = createSound(paperAudio, 1, 120);

/**
 * Развязка партии. Своим элементом, а не через uifx: нужно знать, когда звук
 * кончился — следом встаёт музыка, — а uifx наружу ни элемента, ни события конца
 * не отдаёт. Элемент заводится сразу, чтобы браузер успел скачать файл заранее:
 * развязка не должна начинаться с паузы на загрузку.
 */
const createEndSound = (file: string, volume: number): ((onEnded: () => void) => void) => {
	let sound: HTMLAudioElement | null = null;
	try {
		sound = new Audio(file);
	} catch (e) {
		console.warn('Sound init failed', e);
	}
	return (onEnded: () => void) => {
		if (!sound) return onEnded();
		sound.volume = mix(volume);
		// Партия может кончиться и второй раз, в следующей игре, — тем же элементом.
		sound.currentTime = 0;
		sound.onended = onEnded;
		// Не дали сыграть (политика автовоспроизведения) — музыку всё равно заводим:
		// ей откажут ровно так же, и молча.
		sound.play().catch(() => onEnded());
	};
};

// Записи сведены на разном уровне, отсюда и разные доли: одна громкая (−12.3 дБ)
// и её приглушаем, вторая тихая (−22.7 дБ) и идёт как есть.
const playSpiesWin = createEndSound(spiesWinAudio, 0.55);
const playSpiesLose = createEndSound(spiesLoseAudio, 1);

/**
 * Тема. Звучит везде, где партии нет: с открытия игры, в лобби, за столом до
 * начала — и снова после развязки, пока не начнут следующую. Собственная
 * громкость низкая: это фон под выбор игры и разбор партии, а не номер.
 *
 * Это уровень записи в сведении, а не то, что крутит игрок: его ползунок —
 * множитель поверх (см. mixMusic). Сама музыка, её ротация и петля живут в
 * helpers/music — сюда от неё приходит только громкость.
 */
const musicBaseVolume = 0.45;

export const startMusic = (): void => igniteMusic(mixMusic());
export {stopMusic};

/**
 * Развязка: сперва её звук, следом — новая тема в петле. Именно следом, а не
 * вместе: сами записи громкие, и музыка под ними всё равно не слышна.
 */
export const playGameEnd = (isSpiesWin: boolean): void => {
	if (isSpiesWin) playSpiesWin(startMusic);
	else playSpiesLose(startMusic);
};
