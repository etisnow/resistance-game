import {test, Browser, Page} from '@playwright/test';
import {GameSession, startGame, fill} from './helpers/nechto';

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];
const DIR = '/tmp/claude-1000/-home-neer-projects-nechto/a13b7205-6f27-46e8-a087-fbb33666c3f5/scratchpad';

const dump = async (page: Page, label: string) => {
	const state = await page.evaluate(() => {
		const gc = (window as unknown as {__nechto: Record<string, unknown>}).__nechto;
		const plain = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));
		return {
			isGameOver: gc.isGameOver,
			pendingGameEnd: plain(gc.pendingGameEnd),
			notifications: plain(gc.notifications),
			currentAction: plain(gc.currentAction),
			isPlayerCanCancel: gc.isPlayerCanCancel,
			panicCard: plain(gc.panicCard),
			cardEffects: plain(gc.cardEffects),
			playersList: plain(gc.playersList),
			players: Object.fromEntries(Object.entries(plain(gc.players) as Record<string, {nickname: string, turnState: string, state: string}>)
				.map(([id, p]) => [p.nickname, {turnState: p.turnState, state: p.state, id}])),
			turnPlayerId: gc.turnPlayerId,
			log: (plain(gc.gameLog) as {text: string}[]).slice(-4).map((l) => l.text),
		};
	});
	console.log(`\n===== ${label} =====\n` + JSON.stringify(state, null, 1));
};

test.describe.serial('repro: конец игры через огнемёт', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});
	test.afterAll(async () => { await session.close(); });

	test('люди сжигают Нечто', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Bob',
			things: ['Alice'],
			hands: {Bob: fill(['flamethrower']), Alice: fill([], 4)},
		});

		await session.play('Bob', 'flamethrower');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Bob', 'Alice');
		await session.waitFor('Bob', (s) => s.gameLog.some((l) => l.includes('заживо сожжен')));

		for (const [ms, label] of [[500, 'burn+0.5s'], [3000, 'burn+3.5s'], [4000, 'burn+7.5s'], [5000, 'burn+12.5s']] as [number, string][]) {
			await session.page('Bob').waitForTimeout(ms);
			await dump(session.page('Bob'), `BOB ${label}`);
			await session.page('Bob').screenshot({path: `${DIR}/burn-thing-bob-${label}.png`});
		}
		await dump(session.page('Carol'), 'CAROL final');
		await session.page('Carol').screenshot({path: `${DIR}/burn-thing-carol.png`});
	});

	test('Нечто побеждает: сжигают последнего чистого', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Bob',
			things: ['Alice'],
			infected: ['Bob', 'Dave', 'Erin'],
			hands: {Bob: fill(['flamethrower']), Carol: fill([], 4)},
		});

		await session.play('Bob', 'flamethrower');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'playerSelect');
		const snap = await session.snapshot('Bob');
		console.log('playersToSelect', snap.currentAction?.playersToSelect, JSON.stringify(
			Object.fromEntries(Object.values(snap.players).map((p) => [p.id, p.nickname]))));
		await session.selectPlayer('Bob', 'Carol');
		await session.waitFor('Bob', (s) => s.gameLog.some((l) => l.includes('заживо сожжен')));

		for (const [ms, label] of [[500, 'burn+0.5s'], [3000, 'burn+3.5s'], [4000, 'burn+7.5s'], [5000, 'burn+12.5s']] as [number, string][]) {
			await session.page('Bob').waitForTimeout(ms);
			await dump(session.page('Bob'), `BOB ${label}`);
			await session.page('Bob').screenshot({path: `${DIR}/thingwin-bob-${label}.png`});
		}
	});
});
