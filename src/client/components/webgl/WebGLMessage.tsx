import './style.scss';
import React from 'react';
import {detectBrowser, TBrowser} from 'client/helpers/browser';

interface IBrowserHelp {
	title: string;
	// Внутренний адрес настроек. Кликабельной ссылкой его сделать нельзя: переход
	// на chrome:// / about: со страницы браузер блокирует — поэтому копируем.
	address?: string;
	steps: string[];
}

const HELP: Record<TBrowser, IBrowserHelp> = {
	chrome: {
		title: 'Chrome',
		address: 'chrome://settings/system',
		steps: [
			'Включи «Использовать аппаратное ускорение (при наличии)» и нажми «Перезапустить».',
			'Если не помогло — открой chrome://gpu и посмотри строку WebGL.',
		],
	},
	edge: {
		title: 'Edge',
		address: 'edge://settings/system',
		steps: [
			'Включи «Использовать аппаратное ускорение (при наличии)» и перезапусти браузер.',
			'Проверить состояние графики можно на edge://gpu.',
		],
	},
	opera: {
		title: 'Opera',
		address: 'opera://settings/system',
		steps: [
			'Включи «Использовать аппаратное ускорение (при наличии)» и перезапусти браузер.',
		],
	},
	yandex: {
		title: 'Яндекс Браузер',
		address: 'browser://settings/system',
		steps: [
			'Включи «Использовать аппаратное ускорение (при наличии)» и перезапусти браузер.',
		],
	},
	firefox: {
		title: 'Firefox',
		address: 'about:config',
		steps: [
			'Найди параметр webgl.disabled и поставь ему значение false.',
			'В Настройках → Общие → Производительность включи «Использовать рекомендуемые настройки производительности».',
			'Текущее состояние видно на about:support в разделе «Графика».',
		],
	},
	safari: {
		title: 'Safari',
		steps: [
			'Настройки → Дополнения → включи «Показывать меню "Разработка"».',
			'Затем Разработка → Экспериментальные функции → включи WebGL.',
		],
	},
	unknown: {
		title: 'Твой браузер',
		steps: [
			'Найди в настройках «аппаратное ускорение» (hardware acceleration) и включи его.',
			'Затем перезагрузи страницу.',
		],
	},
};

const AddressLine = ({address}: {address: string}) => {
	const [copied, setCopied] = React.useState(false);
	const copy = () => {
		// clipboard недоступен на http без localhost — тогда просто оставляем текст.
		navigator.clipboard?.writeText(address).then(() => {
			setCopied(true);
			globalThis.setTimeout(() => setCopied(false), 2000);
		}).catch(() => undefined);
	};
	return (
		<div className={'webgl-address'}>
			<code>{address}</code>
			<button type={'button'} className={'webgl-copy'} onClick={copy}>
				{copied ? 'скопировано' : 'скопировать'}
			</button>
		</div>
	);
};

// Показывается, когда PIXI не может инициализироваться: без WebGL игра
// не рисуется совсем, поэтому объясняем, что включить — сразу для того
// браузера, из которого пришли.
export function WebGLMessage() {
	const browser = detectBrowser();
	const help = HELP[browser];

	return (
		<div className={'webgl-message'}>
			<h1>Графика не запустилась</h1>
			<p>Игра рисует стол через <b>WebGL</b>, а браузер его не даёт.</p>
			<p className={'webgl-browser'}>{help.title}: включи WebGL и перезагрузи страницу.</p>
			{help.address && (
				<>
					<p className={'webgl-hint'}>Скопируй адрес и вставь в адресную строку — по ссылке браузер туда не пустит:</p>
					<AddressLine address={help.address}/>
				</>
			)}
			<ol>
				{help.steps.map((step) => <li key={step}>{step}</li>)}
			</ol>
			<p className={'webgl-hint'}>
				WebGL так же отключают расширения-блокировщики и режим экономии батареи.
				Проверить, заработал ли он: <a href={'https://get.webgl.org/'} target={'_blank'} rel={'noreferrer'}>get.webgl.org</a>
			</p>
		</div>
	);
}
