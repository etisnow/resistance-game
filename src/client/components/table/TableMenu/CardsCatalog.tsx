import React from 'react';
import {map} from 'lodash';

import {resources} from 'client/resources/resources';
import {cardNames} from 'shared/constant/cardNames';
import {cardSections} from 'shared/constant/cardSections';
import CardHint from 'client/components/hint/CardHint';

// Справочник карт из меню: миниатюры по три в ряд, разбитые на разделы. Стол
// сквозь него видно — модалка полупрозрачная, чтобы можно было свериться с
// происходящим, не закрывая справочник. Полный вид карты — по наведению, за
// это отвечает уже готовый CardHint (там же и тап на тач-экранах).

const cardImages = resources as unknown as {[key: string]: string | undefined};

const cardName = (cardId: string) => (cardNames as {[key: string]: string | undefined})[cardId] || cardId;

interface ICardsCatalogProps {
	onClose: () => void;
}

const CardsCatalog = ({onClose}: ICardsCatalogProps) => (
	<div className={'cardsCatalogOverlay'} onClick={onClose}>
		<div className={'cardsCatalog'} onClick={(e) => e.stopPropagation()}>
			<div className={'cardsCatalogTitle'}>Карты</div>
			<div className={'cardsCatalogScroll'}>
				{map(cardSections, (section) => (
					<div className={'cardsCatalogSection'} key={section.title}>
						<div className={'cardsCatalogSectionTitle'}>{section.title}</div>
						<div className={'cardsCatalogGrid'}>
							{map(section.cardIds, (cardId) => (
								<CardHint key={cardId} cardId={cardId} className={'cardsCatalogItem'}>
									<img
										className={'cardsCatalogThumb'}
										src={cardImages[cardId]}
										alt={cardName(cardId)}
										data-catalog-card={cardId}
									/>
								</CardHint>
							))}
						</div>
					</div>
				))}
			</div>
			<button className={'tableMenuItem cardsCatalogBack'} onClick={onClose}>Назад</button>
		</div>
	</div>
);

export default CardsCatalog;
