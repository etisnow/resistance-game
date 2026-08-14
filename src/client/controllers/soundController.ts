import {observable} from 'mobx';
import RootController from 'client/controllers/rootController';
import {applyMusicVolume, applySoundVolume, startMusic} from 'client/helpers/sounds';

// Громкость — настройка игрока, а не игры: её ставят один раз и помнят.
// Локальное хранилище, а не localforage (им хранится ник): читать надо
// синхронно, ещё до первого звука, иначе первый же гонг прозвучит на громкости
// по умолчанию — и как раз он звучит раньше, чем игрок доберётся до меню.
const soundVolumeKey = 'soundVolume';
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

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Громкости игры. Ползунка два, и они независимы: звуки за столом и музыка —
 * разные вещи, и чаще всего убавить хотят вторую, не трогая первую (или
 * наоборот — сесть под тему и приглушить возню с картами). Общего ползунка над
 * ними нет: их всего два, и «выключить всё» — это два движения, а не одно.
 *
 * Сами записи, их доли в сведении и вся арифметика живут в client/helpers/sounds.
 * Контроллеру принадлежит только то, что крутит игрок: он это хранит, отдаёт
 * меню на отрисовку и толкает в звук.
 *
 * Заводится в конструкторе RootController, а не в start(): тот дёргается на
 * каждый реконнект, и настройка сбрасывалась бы на сохранённую посреди партии —
 * вместе с той, что игрок только что выставил.
 */
export default class SoundController {
	root: RootController;
	parent: RootController;

	@observable volume: number = loadVolume(soundVolumeKey);
	@observable musicVolume: number = loadVolume(musicVolumeKey);

	constructor(root: RootController, parent: RootController) {
		this.root = root;
		this.parent = parent;
		// Звук о хранилище не знает: не скажи ему сейчас — и до первого движения
		// ползунка игра шла бы на максимуме вместо сохранённого уровня.
		applySoundVolume(this.volume);
		applyMusicVolume(this.musicVolume);
		// Тема встаёт вместе с игрой, а не после первой партии: открывший её слышит
		// «Нечто» с первого экрана и до того, как сядет за стол. Снимет её начало
		// партии (см. socketController и GameController.updateGame).
		//
		// Здесь, а не в start(): тот дёргается на каждый реконнект, и тема
		// начиналась бы заново посреди лобби.
		startMusic();
	}

	setVolume = (value: number) => {
		this.volume = clamp(value);
		applySoundVolume(this.volume);
		saveVolume(soundVolumeKey, this.volume);
	};

	setMusicVolume = (value: number) => {
		this.musicVolume = clamp(value);
		applyMusicVolume(this.musicVolume);
		saveVolume(musicVolumeKey, this.musicVolume);
	};
}
