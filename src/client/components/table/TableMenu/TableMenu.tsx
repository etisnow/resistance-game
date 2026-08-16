import React from 'react';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import {playPaper} from 'client/helpers/sounds';
import {MenuButton, MenuPanel, VolumeSlider} from 'client/components/util/menu/GameMenu';

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
	// Громкости своего состояния здесь не заводят: настройка глобальная и
	// переживает меню, так что живёт она в SoundController, а меню её только
	// рисует и двигает.
	const sound = controller.root.soundController;

	const closeMenu = () => {
		setExitConfirm(false);
		controller.closeMenu();
	};

	// Меню закрывает не только своя кнопка: контроллер гасит его на новом ходе и
	// при выходе со стола. Чтобы справочник не всплыл сам собой при следующем
	// открытии меню, сбрасываем его вместе с меню.
	React.useEffect(() => {
		if (!controller.isMenuOpen) {
			setExitConfirm(false);
		}
	}, [controller.isMenuOpen]);

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
		return <MenuButton onClick={controller.toggleMenu}/>;
	}


	const exitText = controller.isGameOver
		? 'Выйти в лобби'
		: isExitConfirm ? 'Точно выйти? Нажми ещё раз' : 'Выйти в лобби';

	return (
		<MenuPanel onClose={closeMenu}>
			{controller.isGameOver && <div className={'gameMenuTitle'}>Игра закончена</div>}
			<button className={'gameMenuItem danger'} onClick={handleExitClick}>{exitText}</button>
			{/* Вид стола: меню не закрывается, чтобы переключатель можно было
			    щёлкнуть туда-обратно и выбрать. Настройка переживает партию и
			    перезаход — см. toggleFirstPersonTable. */}
			<button className={'gameMenuItem toggle'} onClick={controller.toggleFirstPersonTable}>
				Стол от первого лица
				<span className={'gameMenuToggle' + (controller.isFirstPersonTable ? ' on' : '')}/>
			</button>
			{/* Звуки стола. Отпустив ползунок, игрок слышит шелест карты — иначе
			    выставлять уровень пришлось бы вслепую, дожидаясь следующего
			    события за столом. */}
			<VolumeSlider
				label={'Звуки'}
				value={sound.volume}
				onChange={sound.setVolume}
				onRelease={() => playPaper()}
			/>
			{/* Музыка — своим ползунком: тема играет фоном и подолгу, и убавляют
			    её отдельно от звуков, а не вместе с ними. Отдельного отклика на
			    отпускание нет: когда тема играет, ползунок слышно на лету, а когда
			    не играет — отвечать нечем. */}
			<VolumeSlider
				label={'Музыка'}
				value={sound.musicVolume}
				onChange={sound.setMusicVolume}
			/>
			<button className={'gameMenuItem'} onClick={closeMenu}>
				{controller.isGameOver ? 'Остаться и почитать лог' : 'Вернуться к игре'}
			</button>
		</MenuPanel>
	);
});

export default TableMenu;
