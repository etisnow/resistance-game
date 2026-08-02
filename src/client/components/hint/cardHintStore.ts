import {observable, runInAction} from 'mobx';
import type {IHintAnchor} from 'client/components/hint/HoverHint';

// Стол нарисован на канвасе: у двери и отметок карантина нет DOM-узла, который
// можно было бы обернуть в HoverHint. Поэтому подсказку для «сыгранных на стол»
// карт открывает сам обработчик нажатия — через это маленькое хранилище, а
// рисует её CardHintOverlay поверх стола.
class CardHintStore {
	@observable cardId: string | null = null;
	@observable anchor: IHintAnchor | null = null;
	// Прикнопленная подсказка живёт до крестика или тапа мимо и потому закрывает
	// собой стол. Открытая наведением — наоборот, не должна мешать столу: он под
	// ней продолжает получать движения курсора, иначе наведение сразу теряется.
	@observable isPinned: boolean = true;

	show = (cardId: string, anchor: IHintAnchor, isPinned: boolean = true) => {
		runInAction(() => {
			this.cardId = cardId;
			this.anchor = anchor;
			this.isPinned = isPinned;
		});
	};

	hide = () => {
		runInAction(() => {
			this.cardId = null;
			this.anchor = null;
			this.isPinned = true;
		});
	};

	// Повторное нажатие по тому же месту закрывает подсказку — так же, как
	// повторный клик по слову в логе.
	toggle = (cardId: string, anchor: IHintAnchor) => {
		const isSame = this.cardId === cardId
			&& !!this.anchor
			&& this.anchor.left === anchor.left
			&& this.anchor.top === anchor.top;
		if (isSame) {
			this.hide();
			return;
		}
		this.show(cardId, anchor);
	};
}

export const cardHintStore = new CardHintStore();
