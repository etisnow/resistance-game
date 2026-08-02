import {EEventID, EPanicID} from 'shared/enum/cards';

// Тексты лога сервер пишет свободной строкой (см. game.addLog), поэтому карту в
// них узнаём по названию. Здесь перечислены все формы, в которых карта реально
// называется: падежи, обе орфографии с ё/е и кавычки там, где без них слово
// слишком обычное («мимо» — наречие, «Мимо!» — карта).
const CARD_ALIASES: {[key in EEventID | EPanicID]?: string[]} = {
	[EEventID.tenacity]: ['упорство', 'упорства', 'упорству'],
	[EEventID.fear]: ['страх', 'страха'],
	[EEventID.suspicion]: ['подозрение', 'подозрения'],
	[EEventID.leaveMeAlone]: ['мне и здесь неплохо'],
	[EEventID.positionswap]: ['меняемся местами'],
	[EEventID.flamethrower]: [
		'огнемет', 'огнемёт', 'огнемета', 'огнемёта', 'огнеметом', 'огнемётом', 'огнемете', 'огнемёте',
	],
	[EEventID.reelFishingRods]: ['сматывай удочки', 'сматывает удочки', 'сматывать удочки'],
	[EEventID.axe]: ['топор', 'топора', 'топором'],
	[EEventID.lookaround]: ['гляди по сторонам'],
	[EEventID.whiskey]: ['виски'],
	[EEventID.barricade]: [
		'заколоченная дверь', 'заколоченной двери', 'заколоченную дверь', 'заколоченной дверью',
		'заколоченные двери', 'заколоченных дверей', 'заколоченными дверями',
	],
	[EEventID.seduction]: ['соблазн', 'соблазна', 'соблазном'],
	[EEventID.infect]: ['заражение', 'заражения', 'заражением'],
	[EEventID.quarantine]: ['карантин', 'карантина', 'карантине', 'карантину', 'карантином', 'карантины'],
	[EEventID.noFire]: ['никакого шашлыка'],
	[EEventID.analysis]: ['анализ', 'анализа'],
	[EEventID.noThanks]: ['нет уж, спасибо', 'нет уж спасибо'],
	[EEventID.miss]: ['"мимо"', '«мимо»'],

	[EPanicID.threeFour]: ['три, четыре'],
	[EPanicID.chainReaction]: ['цепная реакция', 'цепной реакции'],
	[EPanicID.blindDate]: ['свидание вслепую', 'свидания вслепую'],
	[EPanicID.oldRopes]: ['старые веревки', 'старые верёвки', 'старых веревок', 'старых верёвок'],
	[EPanicID.oneTwo]: ['раз-два', 'раз, два'],
	[EPanicID.onlyBetweenUs]: ['только между нами'],
	[EPanicID.youCallThisParty]: ['и это вы называете вечеринкой'],
	[EPanicID.goAway]: ['убирайся прочь'],
	[EPanicID.oops]: ['уупс', 'упс'],
	[EPanicID.friendship]: ['давай дружить'],
	[EPanicID.forgetfulness]: ['забывчивость', 'забывчивости'],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cardIdByAlias = new Map<string, string>();
Object.entries(CARD_ALIASES).forEach(([cardId, aliases]) => {
	(aliases || []).forEach((alias) => cardIdByAlias.set(alias, cardId));
});

// Длинные названия первыми: иначе «карантин» откусит начало у «карантина», а
// «нет уж спасибо» никогда не выиграет у своей же более короткой формы.
const aliasPattern = Array.from(cardIdByAlias.keys())
	.sort((a, b) => b.length - a.length)
	.map(escapeRegExp)
	.join('|');

// \b в JS считает словом только латиницу, поэтому границы слова проверяем сами.
const LETTER = /[0-9a-zа-яё]/i;

const isWordBoundary = (char: string | undefined) => !char || !LETTER.test(char);

export interface ICardMentionPart {
	text: string;
	// Есть, если этот кусок текста — название карты.
	cardId?: string;
}

// Режет строку на куски, помечая те, что оказались названием карты.
export const splitCardMentions = (text: string): ICardMentionPart[] => {
	if (!text) return [];
	const parts: ICardMentionPart[] = [];
	const pattern = new RegExp(aliasPattern, 'gi');
	let lastIndex = 0;
	let match = pattern.exec(text);
	while (match) {
		const found = match[0];
		const start = match.index;
		const end = start + found.length;
		// Совпадение должно быть отдельным словом: «карантин» внутри
		// «карантинного» — не упоминание карты.
		const cardId = cardIdByAlias.get(found.toLowerCase());
		if (cardId && isWordBoundary(text[start - 1]) && isWordBoundary(text[end])) {
			if (start > lastIndex) parts.push({text: text.slice(lastIndex, start)});
			parts.push({text: found, cardId});
			lastIndex = end;
		}
		match = pattern.exec(text);
	}
	if (lastIndex < text.length) parts.push({text: text.slice(lastIndex)});
	return parts;
};
