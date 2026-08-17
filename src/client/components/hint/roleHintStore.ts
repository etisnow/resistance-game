import {observable, runInAction} from 'mobx';
import type {TRoleMark} from 'client/helpers/roleMark';
import type {IHintAnchor} from 'client/components/hint/HoverHint';

/**
 * Что за роль этот жетон на кружке. Стол нарисован на канвасе: у жетона нет
 * DOM-узла, который можно было бы обернуть в HoverHint, — поэтому подсказку
 * открывает сам обработчик наведения, через это маленькое хранилище, а рисует
 * её RoleHintOverlay поверх стола (см. canvasHint).
 */
class RoleHintStore {
	@observable role: TRoleMark | null = null;
	// Свой жетон или чужой: у Мерлина «тебе видно, кто шпион», у чужого — «видел».
	@observable isYou: boolean = false;
	@observable anchor: IHintAnchor | null = null;
	// Приколотая подсказка живёт до крестика или нажатия мимо и потому ловит
	// курсор. Открытая наведением — наоборот, столу под ней мешать не должна.
	@observable isPinned: boolean = false;

	show = (role: TRoleMark, isYou: boolean, anchor: IHintAnchor, isPinned: boolean) => {
		runInAction(() => {
			this.role = role;
			this.isYou = isYou;
			this.anchor = anchor;
			this.isPinned = isPinned;
		});
	};

	hide = () => {
		runInAction(() => {
			this.role = null;
			this.anchor = null;
			this.isPinned = false;
		});
	};

	// Курсор ушёл с жетона. Приколотую подсказку это не трогает: её читают, уведя
	// курсор в сторону.
	leave = () => {
		if (this.isPinned) return;
		this.hide();
	};

	// Повторное нажатие по тому же жетону закрывает подсказку — так же, как
	// повторный клик по карточке в стеке действий.
	toggle = (role: TRoleMark, isYou: boolean, anchor: IHintAnchor) => {
		if (this.role === role && this.isPinned && this.anchor?.left === anchor.left) {
			this.hide();
			return;
		}
		this.show(role, isYou, anchor, true);
	};
}

export const roleHintStore = new RoleHintStore();
