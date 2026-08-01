import React from 'react';
import './styles.scss';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';

interface ITableMenuProps {
	controller: GameController;
}

// Пока ActionInteracter показывает свой полноэкранный оверлей (решение по ходу
// или итог игры), кнопка меню только мешает — прячем её, она вернётся сразу
// после того, как игрок ответит или скроет уведомление.
const isBlockingOverlayShown = (controller: GameController): boolean => {
	if (controller.currentAction && controller.currentAction.type === ENotificationAction.actionDecision) return true;
	const firstNotification = controller.notifications.length ? controller.notifications[0] : undefined;
	return !!firstNotification;
};

const TableMenu = observer(({controller}: ITableMenuProps) => {
	const [isExitConfirm, setExitConfirm] = React.useState(false);

	const closeMenu = () => {
		setExitConfirm(false);
		controller.closeMenu();
	};

	const handleExitClick = () => {
		// Из законченной игры выходить нечего — подтверждение только для живой,
		// где выход хоста разваливает стол остальным.
		if (controller.isGameOver || isExitConfirm) {
			setExitConfirm(false);
			controller.backToLauncher();
			return;
		}
		setExitConfirm(true);
	};

	if (!controller.isMenuOpen) {
		if (isBlockingOverlayShown(controller)) return null;
		return (
			<button className={'tableMenuButton'} onClick={controller.toggleMenu}>
				Меню
			</button>
		);
	}

	const exitText = controller.isGameOver
		? 'Выйти в лобби'
		: isExitConfirm ? 'Точно выйти? Нажми ещё раз' : 'Выйти в лобби';

	return (
		<div className={'tableMenuOverlay'} onClick={closeMenu}>
			<div className={'tableMenu'} onClick={(e) => e.stopPropagation()}>
				{controller.isGameOver && <div className={'tableMenuTitle'}>Игра закончена</div>}
				<button className={'tableMenuItem danger'} onClick={handleExitClick}>{exitText}</button>
				<button className={'tableMenuItem'} onClick={closeMenu}>
					{controller.isGameOver ? 'Остаться и почитать лог' : 'Вернуться к игре'}
				</button>
			</div>
		</div>
	);
});

export default TableMenu;
