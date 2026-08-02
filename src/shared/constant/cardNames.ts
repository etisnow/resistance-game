import {EEventID, EPanicID} from 'shared/enum/cards';

// Названия карт ровно так, как они напечатаны на самих картах. Нужны там, где
// карту показывают вне стола: подсказки, alt у картинок, будущие тексты.
export const cardNames: {[key in EEventID | EPanicID]?: string} = {
	[EEventID.tenacity]: 'Упорство',
	[EEventID.fear]: 'Страх',
	[EEventID.suspicion]: 'Подозрение',
	[EEventID.leaveMeAlone]: 'Мне и здесь неплохо',
	[EEventID.positionswap]: 'Меняемся местами!',
	[EEventID.flamethrower]: 'Огнемёт',
	[EEventID.reelFishingRods]: 'Сматывай удочки!',
	[EEventID.axe]: 'Топор',
	[EEventID.lookaround]: 'Гляди по сторонам',
	[EEventID.whiskey]: 'Виски',
	[EEventID.barricade]: 'Заколоченная дверь',
	[EEventID.seduction]: 'Соблазн',
	[EEventID.infect]: 'Заражение!',
	[EEventID.quarantine]: 'Карантин',
	[EEventID.noFire]: 'Никакого шашлыка!',
	[EEventID.analysis]: 'Анализ',
	[EEventID.noThanks]: 'Нет уж, спасибо!',
	[EEventID.miss]: 'Мимо!',
	[EEventID.thing]: 'Нечто',

	[EPanicID.threeFour]: '...три, четыре...',
	[EPanicID.chainReaction]: 'Цепная реакция',
	[EPanicID.blindDate]: 'Свидание вслепую',
	[EPanicID.oldRopes]: 'Старые верёвки',
	[EPanicID.oneTwo]: 'Раз, два...',
	[EPanicID.onlyBetweenUs]: 'Только между нами...',
	[EPanicID.youCallThisParty]: 'И это вы называете вечеринкой?',
	[EPanicID.goAway]: 'Убирайся прочь!',
	[EPanicID.oops]: 'Уупс!',
	[EPanicID.friendship]: 'Давай дружить?',
	[EPanicID.forgetfulness]: 'Забывчивость',
};

// Название карты для строки лога. Кавычки нужны не только для читаемости:
// по названию клиент вешает на слово подсказку с самой картой (cardMentions),
// поэтому писать карту в лог руками не надо — только через этот хелпер.
export const cardLogName = (cardId: EEventID | EPanicID) => `«${cardNames[cardId] || cardId}»`;
