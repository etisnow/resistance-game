import React from 'react';
import './styles.scss';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import CardsCatalog from 'client/components/table/TableMenu/CardsCatalog';
import {playPaper} from 'client/helpers/sounds';

interface ITableMenuProps {
	controller: GameController;
}

interface IVolumeSliderProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
	/** Чем отозваться, когда ползунок отпустили. Музыке не нужно — она уже играет. */
	onRelease?: () => void;
}

/**
 * Пункт-ползунок. Не кнопка: ползунок ловит нажатия сам, и меню от них
 * закрываться не должно.
 */
const VolumeSlider = ({label, value, onChange, onRelease}: IVolumeSliderProps) => (
	<div className={'tableMenuItem slider'}>
		<span className={'tableMenuSliderLabel'}>{label}</span>
		<input
			type={'range'}
			className={'tableMenuSliderInput'}
			min={0}
			max={100}
			step={1}
			value={Math.round(value * 100)}
			onChange={(event) => onChange(Number(event.target.value) / 100)}
			onPointerUp={onRelease}
			onKeyUp={onRelease}
		/>
		<span className={'tableMenuSliderValue'}>{Math.round(value * 100)}</span>
	</div>
);

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
	const [isCardsOpen, setCardsOpen] = React.useState(false);
	// Громкости своего состояния здесь не заводят: настройка глобальная и
	// переживает меню, так что живёт она в SoundController, а меню её только
	// рисует и двигает.
	const sound = controller.root.soundController;

	const closeMenu = () => {
		setExitConfirm(false);
		setCardsOpen(false);
		controller.closeMenu();
	};

	// Меню закрывает не только своя кнопка: контроллер гасит его на новом ходе и
	// при выходе со стола. Чтобы справочник не всплыл сам собой при следующем
	// открытии меню, сбрасываем его вместе с меню.
	React.useEffect(() => {
		if (!controller.isMenuOpen) {
			setExitConfirm(false);
			setCardsOpen(false);
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
		return (
			<button className={'tableMenuButton'} onClick={controller.toggleMenu}>
				Меню
			</button>
		);
	}

	if (isCardsOpen) return <CardsCatalog onClose={() => setCardsOpen(false)}/>;

	const exitText = controller.isGameOver
		? 'Выйти в лобби'
		: isExitConfirm ? 'Точно выйти? Нажми ещё раз' : 'Выйти в лобби';

	return (
		<div className={'tableMenuOverlay'} onClick={closeMenu}>
			<div className={'tableMenu'} onClick={(e) => e.stopPropagation()}>
				{controller.isGameOver && <div className={'tableMenuTitle'}>Игра закончена</div>}
				<button className={'tableMenuItem danger'} onClick={handleExitClick}>{exitText}</button>
				<button className={'tableMenuItem'} onClick={() => setCardsOpen(true)}>Карты</button>
				{/* Вид стола: меню не закрывается, чтобы переключатель можно было
				    щёлкнуть туда-обратно и выбрать. Настройка переживает партию и
				    перезаход — см. toggleFirstPersonTable. */}
				<button className={'tableMenuItem toggle'} onClick={controller.toggleFirstPersonTable}>
					Стол от первого лица
					<span className={'tableMenuToggle' + (controller.isFirstPersonTable ? ' on' : '')}/>
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
				<button className={'tableMenuItem'} onClick={closeMenu}>
					{controller.isGameOver ? 'Остаться и почитать лог' : 'Вернуться к игре'}
				</button>
			</div>
		</div>
	);
});

export default TableMenu;
