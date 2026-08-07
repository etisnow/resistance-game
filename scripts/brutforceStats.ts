// Одноразовый прогон фаззера ради статистики: сколько партий выигрывает Нечто,
// когда все боты ходят случайными картами.
// Запуск: bun run scripts/brutforceStats.ts <iterations> [playersCount]
import {runBrutforce} from '_integration/brutforce';

const iterations = Number(process.argv[2] ?? 100);
const playersCount = process.argv[3] ? Number(process.argv[3]) : undefined;
const started = Date.now();
const result = runBrutforce(iterations, {silent: true, playersCount});
const elapsed = (Date.now() - started) / 1000;

console.log(JSON.stringify({
	iterations: result.iterations,
	playersCount: playersCount ?? 11,
	thingWins: result.thingWins,
	humanWins: result.iterations - result.thingWins,
	seconds: elapsed,
}));
