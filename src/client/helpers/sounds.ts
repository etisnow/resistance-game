import UIfxImport from 'uifx';
import bellAudio from 'client/resources/sound/beep.mp3';
import flamethrowerAudio from 'client/resources/sound/flamethrower.mp3';
import barricadeAudio from 'client/resources/sound/barricade.mp3';
import noFireAudio from 'client/resources/sound/noFire.mp3';
import tenacityAudio from 'client/resources/sound/tenacity.mp3';
import suspicionAudio from 'client/resources/sound/suspicion.mp3';
import analysisAudio from 'client/resources/sound/analysis.mp3';
import whiskeyAudio from 'client/resources/sound/whiskey.mp3';
import negativeAudio from 'client/resources/sound/negative.mp3';
import axeAudio from 'client/resources/sound/axe.mp3';
import quarantineAudio from 'client/resources/sound/quarantine.mp3';
import seductionAudio from 'client/resources/sound/seduction.mp3';
import moveAudio from 'client/resources/sound/move.mp3';
import paperAudio from 'client/resources/sound/paper.mp3';
import panicAudio from 'client/resources/sound/panic.mp3';
import discardAudio from 'client/resources/sound/discard.mp3';
import thingWinAudio from 'client/resources/sound/thingWin.mp3';
import thingLoseAudio from 'client/resources/sound/thingLose.mp3';
import musicAudio from 'client/resources/sound/nechto.mp3';
import lookaroundThunderAudio from 'client/resources/sound/lookaroundThunder.mp3';
import lookaroundTurnAudio from 'client/resources/sound/lookaroundTurn.mp3';
import {setPilotFlameVolume, startPilotFlame as ignitePilotFlame, stopPilotFlame} from 'client/helpers/pilotFlame';

// uifx собран как UMD, и сборщики разворачивают его по-разному: vite кладёт в
// default весь module.exports, а сам класс — внутрь, в .default. Без этой
// развёртки `new UIfx(...)` падает с «UIfx is not a constructor», падение съедает
// catch ниже, и звука в игре просто нет — молча, как было с гонгом хода.
const UIfx = (UIfxImport as unknown as {default?: typeof UIfxImport}).default ?? UIfxImport;

// Громкость — настройка игрока, а не игры: её ставят один раз и помнят.
// Локальное хранилище, а не localforage (им хранится ник): читать надо
// синхронно, ещё до первого звука, иначе первый же гонг прозвучит на громкости
// по умолчанию — и как раз он звучит раньше, чем игрок доберётся до меню.
//
// Ползунка два, и они независимы: звуки за столом и музыка — это разные вещи, и
// чаще всего убавить хотят вторую, не трогая первую (или наоборот — сесть под
// тему и приглушить возню с картами). Общего ползунка над ними нет: их всего
// два, и «выключить всё» — это два движения, а не одно.
const volumeKey = 'soundVolume';
const musicVolumeKey = 'musicVolume';

const loadVolume = (key: string): number => {
	try {
		const stored = window.localStorage.getItem(key);
		const saved = Number(stored);
		// Ничего не сохранено, мусор или NaN — играем на максимуме: пришедший в
		// игру впервые должен услышать её такой, какой она задумана, а убавить он
		// всегда успеет.
		if (stored === null) return 1;
		return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
	} catch {
		// Приватный режим и запрет на хранилище: играть это не мешает, громкость
		// просто не переживёт перезаход.
		return 1;
	}
};

const saveVolume = (key: string, value: number): void => {
	try {
		window.localStorage.setItem(key, String(value));
	} catch {
		// см. loadVolume
	}
};

let masterVolume = loadVolume(volumeKey);
let musicLevel = loadVolume(musicVolumeKey);

// Весь набор оказался громче нужного: выровнен он между собой верно, а вот
// уровнем целиком садится на уши — за партию звуков много, и слушать их час
// подряд на прежней громкости тяжело. Поэтому общий множитель, а не правка
// долей у каждого звука: доли выверены друг относительно друга по замерам (см.
// ниже), и трогать их — значит ломать баланс ради одного лишь уровня.
//
// 0.6 — это −40% от прежнего, примерно −4.4 дБ.
const masterGain = 0.6;

/** Итоговая громкость звука: своя доля, ползунок игрока и общий множитель. */
const mix = (volume: number): number => Math.min(1, Math.max(0, volume * masterVolume * masterGain));

/**
 * То же для музыки, но от своего ползунка. Общий множитель тот же: он срезает
 * уровень всей игры разом, и музыка из него не выделена — иначе, убавив набор,
 * мы бы ровно на столько же выпятили тему над ним.
 */
const mixMusic = (): number => Math.min(1, Math.max(0, musicBaseVolume * musicLevel * masterGain));

export const getSoundVolume = (): number => masterVolume;

/** 0 — полная тишина, 1 — как задумано. Промежуточное — доля от задуманного. */
export const setSoundVolume = (value: number): void => {
	masterVolume = Math.min(1, Math.max(0, value));
	// Звуки берут громкость в момент запуска, а запальник уже горит — ему ползунок
	// должен отзываться сразу, иначе крутить его под запальник бессмысленно.
	setPilotFlameVolume(mix(pilotFlameVolume));
	saveVolume(volumeKey, masterVolume);
};

export const getMusicVolume = (): number => musicLevel;

/** Тема, в отличие от звуков, уже играет — ползунок отзывается ей на лету. */
export const setMusicVolume = (value: number): void => {
	musicLevel = Math.min(1, Math.max(0, value));
	if (music) music.volume = mixMusic();
	saveVolume(musicVolumeKey, musicLevel);
};

// Звук — дело неглавное: если браузер не дал завести Audio (а он не даёт,
// например, из-под некоторых политик безопасности), игра всё равно обязана
// подняться. Поэтому неудачная инициализация вырождается в пустышку, а не в
// исключение на старте модуля.
//
// Громкость передаётся в каждый play, а не задаётся один раз при создании:
// ползунок в меню крутит все звуки разом, а собственная доля у каждого своя —
// шелест карты и рёв огнемёта не должны сравняться.
//
// Единица — уровень самой записи, громче не бывает: усилить запись отсюда
// нельзя, только приглушить. Поэтому доли ниже — это выравнивание сверху.
//
// Считаны они не на глаз, а по самим файлам: у каждого измерена громкость самого
// громкого отрезка в 300 мс (у коротких эффектов слух ориентируется на него, а не
// на средний уровень по всей длине — его занижают паузы и хвосты). Разброс был
// в 26 дБ: огнемёт −7.9 дБ против шелеста −33.9. Доли подобраны так, чтобы после
// умножения обычные карты сошлись примерно на −17 дБ, крупные события шли на
// пару-тройку децибел громче, а частое и фоновое — тише.
//
// Единица здесь значит «тише некуда, запись и так тихая», а не «пусть орёт».
// Если правишь — правь после замера, иначе один звук снова перекричит стол.
const createSound = (file: string, volume: number, throttleMs: number): (() => void) => {
	try {
		const sound = new UIfx(file, {volume, throttleMs});
		return () => sound.play(mix(volume));
	} catch (e) {
		console.warn('Sound init failed', e);
		return () => undefined;
	}
};

// Гонг хода: он зовёт к столу, поэтому должен быть слышен, но звучит каждый ход
// и громким быстро надоедает. Сама запись тихая (−22 дБ), так что приглушать её
// почти не приходится.
export const playBell = createSound(bellAudio, 0.75, 100);

/**
 * Рёв огнемёта под анимацию сожжения (см. Burn.tsx). Самая громкая запись в
 * наборе (−7.9 дБ) — её и приглушаем сильнее всех, иначе она перекрикивает стол.
 * После доли остаётся чуть выше обычной карты: событие того стоит, стол ради
 * него замирает на пять секунд.
 *
 * Throttle во всю длину струи: если сожжение прилетело двумя событиями разом,
 * два одинаковых рёва внахлёст дают только кашу.
 */
export const playFlamethrower = createSound(flamethrowerAudio, 0.65, 2600);

/**
 * Огнемёт на изготове: пока за столом выбирают, кого сжечь, у ствола горит
 * запальник (см. client/helpers/pilotFlame — звук считается на месте, файла у
 * него нет). Слышат его все: огнемёт достали при всех, и ждать выстрела всем.
 *
 * Громкость фоновая — это не событие, а то, что стоит за спиной у выбора: около
 * двух десятков децибел ниже обычной карты. Услышать запальник должно быть
 * можно, но горит он долго, и заметным ему быть нечего.
 */
const pilotFlameVolume = 0.21;
export const startPilotFlame = (): void => ignitePilotFlame(mix(pilotFlameVolume));
export {stopPilotFlame};

/**
 * Заколачивание двери: три удара молотком, нарезка из записи (см.
 * scripts/cutBarricadeSound.ts). Единица не оттого, что дверь важнее прочего:
 * запись ударная, вся её громкость в коротких пиках, и по слуху она и так одна
 * из самых тихих в наборе.
 *
 * Throttle во всю длину: заколачивают одну дверь, и два стука внахлёст — это
 * либо эхо, либо каша.
 */
export const playBarricade = createSound(barricadeAudio, 1, 1100);

/**
 * Отражённый огнемёт — «Никакого шашлыка!» (см. scripts/genNoFireSound.ts): та же
 * струя, но с звоном по металлу вместо костра. Громкость огнемётная: это один и
 * тот же выстрел, и по громкости он не должен отличаться от сожжения.
 */
export const playNoFire = createSound(noFireAudio, 0.55, 1200);

// «Упорство» — передёрнутый затвор дробовика, и «Подозрение» — то самое «хмм».
// Обе записи взяты готовыми (см. scripts/importRawSounds.ts), поэтому здесь у них
// только громкость: подгонять её приходится на слух, записи сведены не под нашу
// игру и друг с другом по уровню не сходятся.
// Затвор по замеру идёт вровень с прочими картами, а на слух — громче них:
// звук резкий и весь в щелчке, а щелчок пробивается сильнее, чем показывает
// уровень. Поэтому доля ниже замеренной ровни, на пару децибел.
export const playTenacity = createSound(tenacityAudio, 0.7, 1000);
export const playSuspicion = createSound(suspicionAudio, 0.8, 1600);
// «Анализ» — набирают пробирку. «Виски» — откупоривают бутылку.
//
// Единица у анализа не значит «громко»: запись самая тихая в наборе, и громче
// единицы отсюда не сделать. Ей не хватало уровня даже так, поэтому усилена она
// в самом файле — см. scripts/amplifyRawSounds.ts.
export const playAnalysis = createSound(analysisAudio, 1, 2000);
export const playWhiskey = createSound(whiskeyAudio, 0.85, 800);

// «Топор» — удар. «Карантин» — застёгивают молнию.
export const playAxe = createSound(axeAudio, 0.7, 1400);
export const playQuarantine = createSound(quarantineAudio, 1, 1000);
// «Соблазн».
export const playSeduction = createSound(seductionAudio, 0.65, 1100);

/**
 * Пересадка — общая на «Меняемся местами!» и «Сматывай удочки!»: обе карты
 * делают за столом одно и то же, только вторая дотягивается до любого игрока.
 */
export const playMove = createSound(moveAudio, 1, 900);

/**
 * Карта поехала — шелест бумаги. Звучит на любое её движение: обмен между
 * игроками (CardFlight) и взятие из колоды (CardDraw).
 *
 * На каждое движение отдельно: у обмена их два — сначала свою карту выбрал
 * первый игрок, потом второй, — и слышно должно быть оба. Throttle совсем
 * короткий, только чтобы карты, раздаваемые всем разом (цепная реакция,
 * забывчивость), не зашелестели хором.
 */
export const playPaper = createSound(paperAudio, 1, 120);

/**
 * Из колоды вышла паника. Взятия карты (paper) на неё не звучит: сервер уводит
 * панику мимо руки, на стол (см. makePanic), — это не «взял карту», а событие,
 * которое сейчас случится со всеми.
 */
export const playPanic = createSound(panicAudio, 1, 3000);

/**
 * Карту сбросили. Звучит только у самого сбросившего: что именно он сбросил,
 * остальные не видят и видеть не должны — в логе значится просто «сбросил
 * карту», без названия.
 */
export const playDiscard = createSound(discardAudio, 0.6, 400);

/**
 * Отказ — общий на все защитные карты: «Нет уж, спасибо!», «Страх», «Мимо!» и
 * «Мне и здесь неплохо». Это одно и то же движение по столу — отбиться от чужой
 * карты, — и звучать оно должно одинаково.
 */
export const playNegative = createSound(negativeAudio, 1, 1300);

// «Гляди по сторонам» разворачивает ход стола, и звучит это двумя записями
// разом: гром — удар события, разворот — само действие. Отдельными файлами, а не
// сведённым в один: так их громкости крутятся порознь.
//
// Приглушены обе, и сильнее, чем нужно было бы поодиночке: они звучат вместе, а
// два звука одного уровня дают на слух примерно на три децибела больше каждого
// из них. Доли двигаем только вместе: порознь они разваливают пару — гром должен
// оставаться ударом, а разворот из-под него не вылезать.
const playThunder = createSound(lookaroundThunderAudio, 0.525, 3000);
const playTurn = createSound(lookaroundTurnAudio, 0.35, 3000);
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

// Хохот записан громко (−12.3 дБ), вопль радости — тихо (−22.7 дБ, пик всего
// 0.26). Поэтому доли у них такие разные: хохот приглушаем, вопль отдаём как
// есть, громче записи не сделать. Разница между ними всё равно остаётся около
// пяти децибел — если мешает, вопль надо нормализовать в самом файле.
const playThingWin = createEndSound(thingWinAudio, 0.55);
const playThingLose = createEndSound(thingLoseAudio, 1);

/**
 * Тема «Нечто» после развязки, по кругу. Собственная громкость низкая: это фон
 * под разбор партии и чтение лога, а не номер. Это уровень записи в сведении, а
 * не то, что крутит игрок: его ползунок — множитель поверх (см. mixMusic).
 */
const musicBaseVolume = 0.45;
let music: HTMLAudioElement | null = null;

/**
 * Трек весит под мегабайт — на порядок больше любого звука события, и грузить
 * его вместе с ними на старте партии незачем: он звучит один раз, в самом конце,
 * а до конца доигрывают не все. Поэтому элемент заводится только здесь, в момент
 * первого запуска: до этого от файла в игре есть только его адрес.
 */
export const startMusic = (): void => {
	try {
		if (!music) {
			music = new Audio(musicAudio);
			music.loop = true;
		}
		music.volume = mixMusic();
		music.play().catch(() => undefined);
	} catch (e) {
		console.warn('Music start failed', e);
	}
};

/** Партия закрыта — музыке играть не над чем. */
export const stopMusic = (): void => {
	if (!music) return;
	music.pause();
	music.currentTime = 0;
};

/**
 * Развязка: сперва её звук, следом — тема по кругу. Именно следом, а не вместе:
 * хохот и вопль сами по себе громкие, и музыка под ними всё равно не слышна.
 */
export const playGameEnd = (isThingWin: boolean): void => {
	if (isThingWin) playThingWin(startMusic);
	else playThingLose(startMusic);
};

export const playLookaround = () => {
	playThunder();
	playTurn();
};
