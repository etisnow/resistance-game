import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {concat, each, filter, map, range} from 'lodash';
import {avatarsCount} from 'shared/constant/avatars';
import {shuffle} from 'server/helpers/util';
import {gameServer} from 'server/server/GameServer';
import {spyCount} from 'shared/constant/resistance';
import {EGameLogType} from 'shared/enum/gameLogType';
import {ESpecialRole} from 'shared/enum/role';

// Рассадка, лица и роли.
export const gameStarter = (game: Game) => {
	const playersCount = Object.keys(game.players).length || 0;
	if (!playersCount) throw new Error("количество игроков равно нулю");

	const playerList = Object.keys(game.players);
	// В тестах места не тасуем: сценарии написаны на порядок, в котором игроки
	// садились за стол.
	game.playersList = gameServer.isMock ? playerList : shuffle(playerList, game.rng);

	// Лица раздаём вразнобой: список аватарок один и тот же, и без тасовки за
	// каждым столом сидели бы одни и те же люди в одном и том же порядке.
	// Игроков может оказаться больше, чем лиц, — тогда список идёт по второму
	// кругу, но уже в другом порядке, и одинаковые лица расходятся по столу.
	const avatarDeck = concat(
		[],
		...map(range(Math.ceil(playersCount / avatarsCount)), () => shuffle(range(avatarsCount), game.rng)),
	);

	each(playerList, (playerId, index) => {
		const player = game.players[playerId];
		if (!player) return;
		player.color = index + ''
		player.avatar = avatarDeck[index] + ''
		player.isSpy = false;
		player.isMerlin = false;
		player.isAssassin = false;
		player.isPercival = false;
		player.isMorgana = false;
	});

	// Роли (FR-2). Тасуем сидом партии КОПИЮ списка и первым N раздаём шпионов:
	// сколько их за таким столом — вопрос к таблице, а не к формуле.
	//
	// Копия обязательна: shuffle тасует переданный массив на месте, а playerList —
	// это и есть game.playersList (рассадка выше вернула его же). Тасуя его второй
	// раз, мы переставляли за столом самих игроков — уже после того, как шпионы
	// выбраны первыми N, — и они всякий раз оказывались на первых местах.
	const spies = shuffle(playerList.slice(), game.rng).slice(0, spyCount(playersCount));
	each(spies, (playerId) => {
		const player = game.players[playerId];
		if (player) player.isSpy = true;
	});
	// В лог — только число: сами роли тайна до самой развязки.
	game.addLog(`За столом ${playersCount} чел., из них шпионов: ${spies.length}`, EGameLogType.system);

	if (!game.withMerlin) return;
	dealMerlinRoles(game, spies);
};

/**
 * Мерлин и Убийца (FR-14, FR-15). Состав стола от них не меняется: Мерлин — один
 * из сопротивления, Убийца — один из шпионов, просто у каждого появляется своё
 * дело. Тасуем те же списки тем же сидом партии — и тоже копии, а не сами
 * playersList и spies.
 */
const dealMerlinRoles = (game: Game, spies: string[]): void => {
	const resistance = filter(game.playersList, (playerId) => !game.players[playerId]?.isSpy);
	const merlinId = shuffle(resistance.slice(), game.rng)[0];
	const assassinId = shuffle(spies.slice(), game.rng)[0];
	const merlin = merlinId ? game.players[merlinId] : undefined;
	const assassin = assassinId ? game.players[assassinId] : undefined;
	if (!merlin || !assassin) throw new Error('Некому быть Мерлином или Убийцей');
	merlin.isMerlin = true;
	assassin.isAssassin = true;
	if (game.withPercival) dealPercivalPair(game, resistance, spies);
	forceDevRole(game);
	// Роль каждому рассказывает сам стол: жетон на кружке и подсказка по нему
	// (см. client/components/hint/RoleHint). Окном во весь экран на старте это
	// говорилось ровно один раз — перезагрузивший вкладку оставался с буквой на
	// кружке и без объяснений.
	game.addLog('С Мерлином и Убийцей: за столом есть тот, кто видит шпионов', EGameLogType.system);
};

/**
 * Персиваль и Моргана (FR-16). Оба — из тех, кому роли ещё не досталось:
 * Персиваль из сопротивления помимо Мерлина, Моргана из шпионов помимо Убийцы.
 * Совмещать их с уже названными нельзя — Персиваль-Мерлин знал бы себя, а
 * Моргана-Убийца превратила бы две роли в одну.
 *
 * За столом впятером сопротивления трое, а шпионов двое — то есть пара находится
 * при любом составе (см. spyCount).
 */
const dealPercivalPair = (game: Game, resistance: string[], spies: string[]): void => {
	const freeResistance = filter(resistance, (playerId) => !game.players[playerId]?.isMerlin);
	const freeSpies = filter(spies, (playerId) => !game.players[playerId]?.isAssassin);
	const percival = game.players[shuffle(freeResistance.slice(), game.rng)[0] ?? ''];
	const morgana = game.players[shuffle(freeSpies.slice(), game.rng)[0] ?? ''];
	if (!percival || !morgana) throw new Error('Некому быть Персивалем или Морганой');
	percival.isPercival = true;
	morgana.isMorgana = true;
};

/**
 * Дев-режим: живому игроку отдаём ту роль, которую он попросил в адресе
 * (`?activeRole=`, см. ESpecialRole) — обменяв её с тем, кому она досталась честно.
 *
 * Обмениваем роль целиком, а не выставляем один флаг: состав стола должен
 * остаться прежним — шпионов столько же, Мерлин один, Убийца один. Иначе
 * проверять руками было бы нечего: за таким столом играют уже не по правилам.
 */
const forceDevRole = (game: Game): void => {
	const wanted = game.devForcedRole;
	if (!wanted) return;
	// Человек в партии с ботами один — он и просил роль.
	const human = game.seatedPlayers().find((player) => !player.isBot);
	if (!human) return;
	const holder = game.seatedPlayers().find((player) => hasRole(player, wanted));
	if (!holder || holder === human) return;
	swapRoles(human, holder);
};

const hasRole = (player: Player, role: ESpecialRole): boolean => {
	switch (role) {
		case ESpecialRole.merlin: return player.isMerlin;
		case ESpecialRole.assassin: return player.isAssassin;
		case ESpecialRole.percival: return player.isPercival;
		case ESpecialRole.morgana: return player.isMorgana;
	}
};

const swapRoles = (a: Player, b: Player): void => {
	[a.isSpy, b.isSpy] = [b.isSpy, a.isSpy];
	[a.isMerlin, b.isMerlin] = [b.isMerlin, a.isMerlin];
	[a.isAssassin, b.isAssassin] = [b.isAssassin, a.isAssassin];
	[a.isPercival, b.isPercival] = [b.isPercival, a.isPercival];
	[a.isMorgana, b.isMorgana] = [b.isMorgana, a.isMorgana];
};

