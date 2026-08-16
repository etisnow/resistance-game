import React from 'react';
import {observer} from 'mobx-react-lite';
import SoundController from 'client/controllers/soundController';
import {MenuButton, MenuPanel, VolumeSlider} from 'client/components/util/menu/GameMenu';
import {playPaper} from 'client/helpers/sounds';

interface IAppMenuProps {
	sound: SoundController;
}

/**
 * Меню везде, кроме стола: на загрузке, на входе и в лобби. То же самое, что и
 * за столом, но короче — выходить отсюда некуда и стол разворачивать нечем,
 * остаются громкости. За столом своё меню (см. TableMenu): там к громкостям
 * добавляются выход и вид стола, и прячется оно за полноэкранными вопросами.
 *
 * Нужно оно вне стола потому, что музыка играет с первой секунды, ещё до всякой
 * партии, а убавить её можно было, только сев за стол. Открыто ли меню, помнит
 * сам компонент: настройка внутри общая (SoundController), а створка — дело
 * экрана и партию не переживает.
 */
const AppMenu = observer(({sound}: IAppMenuProps) => {
	const [isOpen, setOpen] = React.useState(false);

	if (!isOpen) return <MenuButton onClick={() => setOpen(true)}/>;

	return (
		<MenuPanel onClose={() => setOpen(false)}>
			{/* Отпустив ползунок, игрок слышит шелест — иначе уровень звуков пришлось
			    бы выставлять вслепую: за столом его проверит первое же событие, а на
			    входе звучать нечему. */}
			<VolumeSlider
				label={'Звуки'}
				value={sound.volume}
				onChange={sound.setVolume}
				onRelease={() => playPaper()}
			/>
			<VolumeSlider
				label={'Музыка'}
				value={sound.musicVolume}
				onChange={sound.setMusicVolume}
			/>
			<button className={'gameMenuItem'} onClick={() => setOpen(false)}>
				Закрыть
			</button>
		</MenuPanel>
	);
});

export default AppMenu;
