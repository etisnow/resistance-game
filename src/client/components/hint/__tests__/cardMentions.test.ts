import {describe, expect, test} from 'bun:test';
import {splitCardMentions} from 'client/components/hint/cardMentions';
import {cardLogName, cardNames} from 'shared/constant/cardNames';
import {EEventID, EPanicID} from 'shared/enum/cards';

// Названия карт в логе — то, за что можно взяться курсором. Разбор строки
// должен склеиваться обратно в исходный текст (иначе строка лога поедет) и не
// хватать лишнего.
const mentions = (text: string) => splitCardMentions(text)
	.filter((part) => part.cardId)
	.map((part) => `${part.cardId}:${part.text}`);

const joined = (text: string) => splitCardMentions(text).map((part) => part.text).join('');

describe('упоминания карт в логе', () => {
	test('находит карту паники по названию', () => {
		const text = 'Паника! Забывчивость: Игрок меняет три карты с руки на три из колоды';
		expect(mentions(text)).toEqual(['forgetfulness:Забывчивость']);
		expect(joined(text)).toBe(text);
	});

	test('узнаёт название в падеже и в кавычках', () => {
		expect(mentions('Игрок Bob не меняется из-за карантина')).toEqual(['quarantine:карантина']);
		expect(mentions('Игрок Bob играет карту "Топор" на Alice')).toEqual(['axe:Топор']);
		expect(mentions('Паника: Все карты "Заколоченная дверь" сбрасываются'))
			.toEqual(['barricade:Заколоченная дверь']);
	});

	test('берёт самое длинное совпадение и все упоминания строки', () => {
		const text = 'Цепная реакция! Все игроки меняются картами по кругу, игнорируя карты '
			+ '"карантин" и "заколоченная дверь". Отказаться от обмена нельзя.';
		expect(mentions(text)).toEqual([
			'chainReaction:Цепная реакция',
			'quarantine:карантин',
			'barricade:заколоченная дверь',
		]);
		expect(joined(text)).toBe(text);
	});

	test('не цепляет название внутри другого слова', () => {
		expect(mentions('Игрок нарушил карантинный режим')).toEqual([]);
		expect(mentions('Игрок Bob страховался')).toEqual([]);
	});

	test('слишком обычные слова считаются картой только в кавычках', () => {
		expect(mentions('Игрок Bob играет карту "Мимо" и отказывается от обмена')).toEqual(['miss:"Мимо"']);
		expect(mentions('Выстрел прошел мимо')).toEqual([]);
	});

	// Виски и паника пишут карты в лог через cardLogName — значит каждое такое
	// название обязано находиться разбором, иначе карта окажется без подсказки.
	test('любая карта, записанная в лог через cardLogName, узнаётся', () => {
		const cardIds = [...Object.values(EEventID), ...Object.values(EPanicID)]
			.filter((cardId) => cardNames[cardId]);
		expect(cardIds.length).toBeGreaterThan(0);
		cardIds.forEach((cardId) => {
			const text = `Вот мои карты: ${cardLogName(cardId)}, и всё`;
			expect(mentions(text).map((mention) => mention.split(':')[0])).toEqual([cardId]);
			expect(joined(text)).toBe(text);
		});
	});

	test('текст без карт остаётся одним куском', () => {
		const text = 'Ходит игрок Alice!';
		expect(splitCardMentions(text)).toEqual([{text}]);
	});
});
