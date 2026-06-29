import {test, expect, Browser} from '@playwright/test';
import {startGame} from './helpers/nechto';

// Полностью детерминированные партии: единственный вход — числовой сид, который
// задаётся серверу ДО раздачи (e2eSeed). Дальше игра играется сама — бот в
// браузере ходит за каждого игрока, опираясь только на видимое игроку состояние
// и на тот же сид; никаких подтасовок состояния (никаких arrange). Тест лишь
// наблюдает эволюцию: кто заразился, кто умер, кто победил. Несколько сидов —
// несколько прогонов; один и тот же сид даёт идентичную партию.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];
const SEEDS = [1, 7, 42, 1337, 2024];

test.describe('Детерминированные авто-партии по сиду', () => {
	for (const seed of SEEDS) {
		test(`сид ${seed}: настоящая раздача → авто-игра до победы одной из сторон`, async ({browser}: {browser: Browser}) => {
			test.setTimeout(300_000);
			const session = await startGame(browser, NICKS, seed);
			try {
				const r = await session.autoplay(seed);

				// Наблюдаемая эволюция партии — в лог теста.
				console.log(`\n[сид ${seed}] победа: ${r.winner === 'thing' ? 'НЕЧТО' : 'ЛЮДИ'} (${r.finalLog}); ходов: ${r.steps}`);
				console.log(`  заражения: ${r.infections.map((i) => `${i.nickname}@шаг${i.step}`).join(', ') || '—'}`);
				console.log(`  смерти:     ${r.deaths.map((d) => `${d.nickname}@шаг${d.step}`).join(', ') || '—'}`);
				console.log(`  итог по игрокам: ${r.finalPlayers.map((p) => `${p.nickname}[${p.isThing ? 'Нечто' : p.isInfected ? 'заражён' : 'чист'}${p.turnState === 'dead' ? ',мёртв' : ''}]`).join(' ')}`);

				// Партия пришла к корректному финалу одной из сторон.
				expect(['thing', 'humans']).toContain(r.winner);
				expect(r.finalLog === 'Нечто победило' || r.finalLog === 'Нечто проиграло').toBe(true);
				expect(r.steps).toBeGreaterThan(3);
				// Ровно один игрок — Нечто на протяжении всей партии.
				expect(r.finalPlayers.filter((p) => p.isThing).length).toBe(1);
				// Победа Нечто ⇒ не осталось чистых живых людей.
				if (r.winner === 'thing') {
					const cleanAlive = r.finalPlayers.filter((p) => !p.isThing && !p.isInfected && p.turnState !== 'dead' && p.state !== 'door');
					expect(cleanAlive.length).toBe(0);
				}
			} finally {
				await session.close();
			}
		});
	}

	test('один и тот же сид даёт идентичную партию (детерминизм)', async ({browser}: {browser: Browser}) => {
		test.setTimeout(300_000);
		const seed = 555;
		const run = async () => {
			const s = await startGame(browser, NICKS, seed);
			try {
				return await s.autoplay(seed);
			} finally {
				await s.close();
			}
		};

		const a = await run();
		const b = await run();

		// Две независимые партии с одним сидом совпадают шаг в шаг.
		expect(b.winner).toBe(a.winner);
		expect(b.steps).toBe(a.steps);
		expect(b.gameLog).toEqual(a.gameLog);
		expect(b.deaths).toEqual(a.deaths);
		expect(b.infections).toEqual(a.infections);
	});
});
