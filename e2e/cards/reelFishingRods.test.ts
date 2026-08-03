import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Сматывай удочки (reelFishingRods): "Поменяйтесь местами с любым игроком по
// вашему выбору, если он не на карантине. Игнорируйте все заколоченные двери."
// Unlike positionswap it can target ANY non-quarantined player, not just
// neighbours, then resolves through the same swap decision.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Сматывай удочки (reelFishingRods)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняется местами с НЕсоседним игроком по выбору', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['reelFishingRods']), Carol: fill([], 4)},
		});

		await session.play('Alice', 'reelFishingRods');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const carolId = await session.idOf('Carol');
		// Carol is two seats away (not a neighbour) yet selectable.
		expect(offered).toContain(carolId);

		const before = (await session.snapshot('Alice')).playersList;
		const aliceId = await session.idOf('Alice');
		// У Carol нет «Мне и здесь неплохо» — обмен проходит без вопроса к ней.
		await session.selectPlayer('Alice', 'Carol');

		await session.waitFor('Alice', (s) => s.playersList.indexOf(aliceId) === before.indexOf(carolId));
		const after = (await session.snapshot('Alice')).playersList;
		expect(after.indexOf(aliceId)).toBe(before.indexOf(carolId));
		expect(after.indexOf(carolId)).toBe(before.indexOf(aliceId));
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});

	test('карантинного игрока выбрать нельзя', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['reelFishingRods'])},
			quarantine: {Carol: 3},
		});

		await session.play('Alice', 'reelFishingRods');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered).not.toContain(await session.idOf('Carol'));
		expect(offered).toContain(await session.idOf('Dave'));
	});
});
