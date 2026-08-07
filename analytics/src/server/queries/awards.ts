import type {IAward, IPlayerSummary} from 'analytics/shared/api';

// Награды — ради них всё и затевалось: сухие проценты никто не обсуждает, а
// «Главный параноик сезона» обсуждают. Каждая награда — это правило выбора
// лидера по одному числу; при равенстве побеждает тот, у кого больше партий.

interface IAwardRule {
	id: string;
	title: string;
	description: string;
	unit: string;
	/** Минимум партий, чтобы новичок с одной партией не забрал все титулы. */
	minMatches: number;
	value: (player: IPlayerSummary) => number;
	/** Награду выдаём, только если значение осмысленное. */
	isEligible?: (player: IPlayerSummary) => boolean;
}

const RULES: IAwardRule[] = [
	{
		id: 'sherlock',
		title: 'Шерлок',
		description: 'Самые точные подозрения: чаще всех оказывался прав, вешая статусы',
		unit: '% точности',
		minMatches: 3,
		value: (p) => p.markAccuracy.rate * 100,
		isEligible: (p) => p.markAccuracy.total >= 10,
	},
	{
		id: 'paranoid',
		title: 'Параноик',
		description: 'Больше всех обвинений: «Нечто» и «заражён» летят от него во все стороны',
		unit: 'обвинений',
		minMatches: 2,
		value: (p) => p.accusations,
	},
	{
		id: 'blind',
		title: 'Слепой крот',
		description: 'Худшая точность подозрений при заметном числе статусов',
		unit: '% промахов',
		minMatches: 3,
		value: (p) => 100 - p.markAccuracy.rate * 100,
		isEligible: (p) => p.markAccuracy.total >= 10,
	},
	{
		id: 'scapegoat',
		title: 'Козёл отпущения',
		description: 'Чаще всех обвиняли зря — а он был чист',
		unit: 'ошибочных обвинений',
		minMatches: 2,
		value: (p) => p.timesWronglyAccused,
	},
	{
		id: 'butcher',
		title: 'Мясник',
		description: 'Больше всех сожжённых — вне зависимости от того, кем они были',
		unit: 'сожжено',
		minMatches: 2,
		value: (p) => p.kills,
	},
	{
		id: 'hero',
		title: 'Герой Антарктики',
		description: 'Чаще всех именно он сжигал настоящее Нечто',
		unit: 'Нечто сожжено',
		minMatches: 2,
		value: (p) => p.thingKills,
	},
	{
		id: 'executioner',
		title: 'Палач невиновных',
		description: 'Больше всех сожжённых чистых людей',
		unit: 'невиновных сожжено',
		minMatches: 2,
		value: (p) => p.innocentKills,
	},
	{
		id: 'patientZero',
		title: 'Разносчик',
		description: 'Чаще всех передавал «Заражение!» дальше по столу',
		unit: 'заражений передано',
		minMatches: 2,
		value: (p) => p.infectionsGiven,
	},
	{
		id: 'victim',
		title: 'Мишень',
		description: 'Чаще всех заражался сам',
		unit: 'заражений получено',
		minMatches: 2,
		value: (p) => p.infectionsReceived,
	},
	{
		id: 'monster',
		title: 'Лучшее Нечто',
		description: 'Самый высокий процент побед в роли Нечто',
		unit: '% побед за Нечто',
		minMatches: 2,
		value: (p) => p.asThing.winRate * 100,
		isEligible: (p) => p.asThing.matches >= 2,
	},
	{
		id: 'survivor',
		title: 'Живучий',
		description: 'Чаще всех доживал до конца партии',
		unit: '% выживания',
		minMatches: 3,
		value: (p) => p.survivalRate * 100,
	},
	{
		id: 'champion',
		title: 'Чемпион',
		description: 'Лучший процент побед за всё время',
		unit: '% побед',
		minMatches: 3,
		value: (p) => p.winRate * 100,
	},
];

export const getAwards = (leaderboard: IPlayerSummary[]): IAward[] => {
	const awards: IAward[] = [];
	for (const rule of RULES) {
		const candidates = leaderboard
			.filter((player) => !player.isBot && player.matches >= rule.minMatches)
			.filter((player) => (rule.isEligible ? rule.isEligible(player) : true))
			.map((player) => ({player, value: rule.value(player)}))
			.filter((row) => row.value > 0)
			.sort((a, b) => b.value - a.value || b.player.matches - a.player.matches);
		const winner = candidates[0];
		if (!winner) continue;
		awards.push({
			id: rule.id,
			title: rule.title,
			description: rule.description,
			playerKey: winner.player.key,
			playerName: winner.player.displayName,
			value: Math.round(winner.value * 10) / 10,
			unit: rule.unit,
		});
	}
	return awards;
};

/** Личные титулы игрока — те награды, которые достались именно ему. */
export const getPlayerAwards = (leaderboard: IPlayerSummary[], key: string): IAward[] =>
	getAwards(leaderboard).filter((award) => award.playerKey === key);
