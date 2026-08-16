import {test, expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {GameSession, startGame} from './helpers/table';

// За молчащего игрока кнопку жмёт сервер (см. askDecision), и вопрос у него на
// экране закрывать некому: очередь уведомлений разбирается нажатием. Такой
// повисший вопрос закрывал собой всё остальное — и кнопку меню, и саму развязку,
// так что из законченной партии было не выйти.

const NICKS = ['Аня', 'Боря', 'Вера', 'Гена', 'Дима'];
const SILENT = 'Дима';

// Сколько сервер ждёт ответа. Срок общий на весь сервер (см. askDecision), а
// сервер у спеков один на прогон, поэтому этот спек обязан вернуть его на место:
// с секундой на ответ соседние спеки не успевали бы нажимать свои кнопки.
const DEFAULT_DECISION_SECONDS = 30;
const setDecisionTimeout = async (page: Page, seconds: number): Promise<void> => {
	await page.evaluate((s) => {
		(window as any).__resistance.socket.socket.emit('e2eDecisionTimeout', {seconds: s});
	}, seconds);
};

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

test('молчащий игрок не запирает себе стол', async ({browser}) => {
	const session = await startGame(browser, NICKS, 1);
	const silent = session.page(SILENT);
	await setDecisionTimeout(silent, 1);

	try {
		// Пять отклонений подряд заканчивают партию — и ни разу не спрашиваем Диму.
		for (let round = 0; round < 5; round++) {
			await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'teamBuilding');
			const [leader] = await session.whoIsAsked('playerSelect');
			await buildTeam(session, leader!);
			await session.decide(leader!, 'confirmTeam');

			await session.waitFor(NICKS[0]!, (s) => s.round?.phase === 'voting');
			for (const nick of NICKS) {
				if (nick === SILENT) continue;
				await session.decide(nick, 'reject');
			}
			// Дождались, пока сервер ответит за молчащего и раунд закроется.
			await session.waitFor(NICKS[0]!, (s) => s.round?.rejectCount === round + 1 || s.round?.phase === 'over');

			if (round === 0) {
				// Партия идёт дальше, а у молчащего на экране пусто: вопрос, за который
				// уже ответил сервер, стол не показывает и меню собой не закрывает.
				await expect(silent.getByRole('button', {name: 'Меню'})).toBeVisible();
			}
		}

		// Развязка: она видна и тому, кто молчал весь стол, и выйти ему есть чем.
		await session.waitFor(SILENT, (s) => s.round?.phase === 'over');
		// Кнопки развязки — не <button>, а слой поверх канваса (см. ActionInteracter).
		await expect(silent.getByText('Выход', {exact: true})).toBeVisible();
	} finally {
		// Срок ответа — общий на сервер, и он переживает не только этот спек, но и
		// весь прогон (playwright переиспользует уже поднятый сервер).
		await setDecisionTimeout(silent, DEFAULT_DECISION_SECONDS).catch(() => undefined);
		await session.close();
	}
});
