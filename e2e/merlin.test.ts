import {test, expect} from '@playwright/test';
import {GameSession, startGame} from './helpers/table';

// Партия с Мерлином и Убийцей (FR-14, FR-15) — от галочки в лобби до выстрела.
// Правила проверяют юнит-тесты движка; здесь важно другое: что настройка доезжает
// до сервера через живое лобби, а выстрел делается тем же выбором игрока за
// столом, каким лидер набирает команду.

const NICKS = ['Аня', 'Боря', 'Вера', 'Гена', 'Дима'];

const buildTeam = async (session: GameSession, leader: string): Promise<void> => {
	for (;;) {
		const snap = await session.snapshot(leader);
		if (snap.currentAction?.type !== 'playerSelect') return;
		const targetId = snap.currentAction.playersToSelect?.[0];
		if (!targetId) throw new Error('Некого брать в команду');
		await session.selectPlayer(leader, await session.nickOf(targetId));
		await session.waitFor(leader, (s) => s.round?.team.includes(targetId) === true);
	}
};

// Кто есть кто, глазами их самих: чужие роли до развязки не видит никто.
type TSelfRole = 'isMerlin' | 'isAssassin' | 'isPercival' | 'isMorgana';

const whoKnowsSelf = async (session: GameSession, field: TSelfRole): Promise<string> => {
	for (const nick of NICKS) {
		const snap = await session.snapshot(nick);
		if (snap.currentPlayerId && snap.players[snap.currentPlayerId]?.[field]) return nick;
	}
	throw new Error(`За столом никто не знает про себя ${field}`);
};

test('с Мерлином три миссии не заканчивают партию: стреляет Убийца', async ({browser}) => {
	const session = await startGame(browser, NICKS, 1, {withMerlin: true});

	const merlin = await whoKnowsSelf(session, 'isMerlin');
	const assassin = await whoKnowsSelf(session, 'isAssassin');
	// Мерлин — из сопротивления, Убийца — шпион, и Мерлина не знает даже он.
	expect((await session.snapshot(merlin)).players[await session.idOf(merlin)]?.isSpy).toBe(false);
	expect((await session.snapshot(assassin)).players[await session.idOf(assassin)]?.isSpy).toBe(true);
	expect((await session.snapshot(assassin)).players[await session.idOf(merlin)]?.isMerlin).toBeNull();

	// Три миссии подряд без единого провала — сопротивление у победы.
	for (let mission = 0; mission < 3; mission++) {
		await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'teamBuilding');
		const [leader] = await session.whoIsAsked('playerSelect');
		await buildTeam(session, leader!);
		await session.decide(leader!, 'confirmTeam');

		await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'voting');
		for (const nick of NICKS) {
			await session.waitFor(nick, (s) => s.currentAction?.type === 'actionDecision');
			await session.decide(nick, 'approve');
		}

		await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'mission');
		for (const nick of await session.whoIsAsked('actionDecision')) await session.decide(nick, 'success');
		await session.waitFor(NICKS[0]!, (s) => s.round!.missionResults[mission] === true);
	}

	// Партия не кончилась: слово за Убийцей, и роли ещё закрыты.
	await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'assassination');
	const shot = await session.snapshot(assassin);
	expect(shot.round!.isRolesRevealed).toBe(false);
	expect(shot.turnPlayerId).toBe(await session.idOf(assassin));
	expect(shot.currentAction?.type).toBe('playerSelect');
	// Стрелять предлагают только по сопротивлению — своих Убийца знает.
	const targets = shot.currentAction?.playersToSelect ?? [];
	for (const id of targets) expect(shot.players[id]?.isSpy).toBe(false);

	// Наводка выстрелом не считается: сначала цель, потом кнопка.
	await session.selectPlayer(assassin, merlin);
	await session.waitFor(assassin, (s) => !!s.round?.assassinAimId);
	const aimed = await session.snapshot(assassin);
	expect(aimed.round!.assassinAimId).toBe(await session.idOf(merlin));
	expect(aimed.round!.assassinTargetId).toBeNull();
	expect(aimed.currentAction?.menu?.map((item) => item.action)).toEqual(['resetAim', 'shoot']);

	// Выстрел в Мерлина отдаёт партию шпионам.
	await session.decide(assassin, 'shoot');
	await session.waitFor(NICKS[0]!, (s) => s.notifications.some((n) => n.type === 'gameEnd'), 20_000);
	const final = await session.snapshot(NICKS[0]!);
	expect(final.round!.phase).toBe('over');
	expect(final.round!.assassinTargetId).toBe(await session.idOf(merlin));
	expect(final.notifications.find((n) => n.type === 'gameEnd')?.isSpiesWin).toBe(true);
	expect(final.gameLog.join(' ')).toContain('Убийца нашёл Мерлина');

	await session.close();
});

test('Персиваль видит двоих и не знает, кто из них Мерлин', async ({browser}) => {
	const session = await startGame(browser, NICKS, 3, {withPercival: true});

	const percival = await whoKnowsSelf(session, 'isPercival');
	const merlin = await whoKnowsSelf(session, 'isMerlin');
	const morgana = await whoKnowsSelf(session, 'isMorgana');
	expect(new Set([percival, merlin, morgana]).size).toBe(3);

	// Мерлин и Моргана для него на одно лицо, остальные — просто остальные.
	const view = (await session.snapshot(percival)).players;
	expect(view[await session.idOf(merlin)]?.looksLikeMerlin).toBe(true);
	expect(view[await session.idOf(morgana)]?.looksLikeMerlin).toBe(true);
	expect(view[await session.idOf(merlin)]?.isMerlin).toBeNull();
	// Стороны ему по-прежнему не видны: он обычный сопротивленец.
	expect(view[await session.idOf(morgana)]?.isSpy).toBeNull();

	// А шпионы про Персиваля не знают ничего — иначе через него вышли бы на Мерлина.
	const spyView = (await session.snapshot(morgana)).players;
	expect(spyView[await session.idOf(percival)]?.isPercival).toBeNull();

	await session.close();
});

test('без галочки в лобби партия остаётся базовой', async ({browser}) => {
	const session = await startGame(browser, NICKS, 1);
	for (const nick of NICKS) {
		const snap = await session.snapshot(nick);
		expect(snap.players[snap.currentPlayerId!]?.isMerlin).toBe(false);
		expect(snap.players[snap.currentPlayerId!]?.isAssassin).toBe(false);
	}
	await session.close();
});
