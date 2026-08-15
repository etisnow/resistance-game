import {test, expect} from '@playwright/test';
import {GameSession, startGame} from './helpers/table';

// Партию впятером можно доиграть до конца через настоящий клиент: пять браузеров,
// живой сокет, никакой подкрутки состояния со стороны спека. Все сдают «Успех»,
// поэтому исход предрешён — проверяем не правила (для них есть юнит-тесты), а то,
// что игра действительно проходима руками.

const NICKS = ['Аня', 'Боря', 'Вера', 'Гена', 'Дима'];

// Лидер набирает команду, тыкая в кружки — ровно так же, как живой игрок.
const buildTeam = async (session: GameSession, leader: string): Promise<void> => {
	for (;;) {
		const snap = await session.snapshot(leader);
		if (snap.currentAction?.type !== 'playerSelect') return;
		const targetId = snap.currentAction.playersToSelect?.[0];
		if (!targetId) throw new Error('Некого брать в команду');
		const targetNick = await session.nickOf(targetId);
		await session.selectPlayer(leader, targetNick);
		await session.waitFor(leader, (s) => s.round?.team.includes(targetId) === true);
	}
};

test('партию впятером играют до победы, набирая команды и голосуя', async ({browser}) => {
	const session = await startGame(browser, NICKS, 1);

	// Три миссии без единого провала — три успеха подряд берут партию.
	for (let mission = 0; mission < 3; mission++) {
		await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'teamBuilding');
		const [leader] = await session.whoIsAsked('playerSelect');
		expect(leader).toBeTruthy();

		await buildTeam(session, leader!);
		await session.decide(leader!, 'confirmTeam');

		// Голосуют все, включая саму команду.
		await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'voting');
		for (const nick of NICKS) {
			await session.waitFor(nick, (s) => s.currentAction?.type === 'actionDecision');
			await session.decide(nick, 'approve');
		}

		// Команда сдаёт карты. Спрашивают только её — остальные ждут.
		await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'mission');
		const team = await session.whoIsAsked('actionDecision');
		expect(team.length).toBe((await session.snapshot(NICKS[0]!)).round!.teamSize);
		for (const nick of team) await session.decide(nick, 'success');

		await session.waitFor(NICKS[0]!, (s) => s.round!.missionResults[mission] === true);
	}

	// Развязка: партия окончена, роли открыты всем.
	await session.waitFor(NICKS[0]!, (s) => s.notifications.some((n) => n.type === 'gameEnd'));
	const final = await session.snapshot(NICKS[0]!);
	expect(final.round!.phase).toBe('over');
	expect(final.round!.isRolesRevealed).toBe(true);
	expect(final.gameLog.join(' ')).toContain('сопротивление победило');

	await session.close();
});
