import React from 'react';
import {map} from 'lodash';
import cn from 'classnames';
import {observer} from 'mobx-react-lite';
import {resources} from 'client/resources/resources';
import {cardNames} from 'shared/constant/cardNames';
import HoverHint, {HintPopup} from 'client/components/hint/HoverHint';
import {splitCardMentions} from 'client/components/hint/cardMentions';
import {cardHintStore} from 'client/components/hint/cardHintStore';

// Карточная подсказка поверх универсальной всплывашки: показываем саму карту —
// крупно, чтобы читался её текст (примерно как карта под курсором в руке).
// Обернуть можно что угодно: слово в логе, миниатюру, бейдж.

const cardImages = resources as unknown as {[key: string]: string | undefined};

const cardName = (cardId: string) => (cardNames as {[key: string]: string | undefined})[cardId] || cardId;

const CardHintImage = ({cardId, image}: {cardId: string, image: string}) => <img
	className={'cardHintImage'}
	src={image}
	alt={cardName(cardId)}
	data-card-hint={cardId}
/>;

interface ICardHintProps {
	cardId: string;
	children: React.ReactNode;
	className?: string;
}

export const CardHint = ({cardId, children, className}: ICardHintProps) => {
	const image = cardImages[cardId];
	// Карты без картинки (рубашки, будущие id) подсказывать нечем — оставляем
	// содержимое как есть, чтобы не открывалось пустое окошко.
	if (!image) return <>{children}</>;
	return <HoverHint
		className={cn('cardMention', className)}
		hintClassName={'cardHint'}
		content={<CardHintImage cardId={cardId} image={image}/>}
	>
		{children}
	</HoverHint>;
};

// Подсказка для того, что нарисовано на канвасе и обернуть не во что: её
// открывает обработчик нажатия на столе (см. canvasHint), а живёт она обычным
// DOM-окошком поверх сцены. Нажатие — жест «прикалывающий», поэтому окошко с
// крестиком и закрывается тапом мимо.
export const CardHintOverlay = observer(() => {
	const {cardId, anchor} = cardHintStore;
	if (!cardId || !anchor) return null;
	const image = cardImages[cardId];
	if (!image) return null;
	return <HintPopup
		anchor={anchor}
		isPinned={true}
		onClose={cardHintStore.hide}
		className={'cardHint'}
	>
		<CardHintImage cardId={cardId} image={image}/>
	</HintPopup>;
});

// Готовый рендер текста с подсказками: каждое найденное название карты
// становится наводибельным.
export const renderCardMentions = (text: string) => map(
	splitCardMentions(text),
	(part, index) => part.cardId
		? <CardHint key={index} cardId={part.cardId}>{part.text}</CardHint>
		: <React.Fragment key={index}>{part.text}</React.Fragment>,
);

export default CardHint;
