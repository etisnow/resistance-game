/**
 * Звуковое устройство браузера — одно на всю игру.
 *
 * Своего контекста хватило бы каждому, кто здесь звучит через Web Audio
 * (запальник огнемёта и тема), но число контекстов браузер ограничивает, а
 * закрывать их и заводить заново на каждое прицеливание — значит однажды
 * получить отказ на ровном месте. Поэтому один на всех и переживает отдельные
 * звуки.
 *
 * Заводится он приостановленным: звук на странице, которую игрок ещё не трогал,
 * браузер не пускает — см. resumeAudio.
 */

type AudioContextCtor = new () => AudioContext;

let context: AudioContext | null = null;
let isFailed = false;

/** Контекст игры. null — Web Audio в этом браузере нет или его не дали завести. */
export const getAudioContext = (): AudioContext | null => {
	if (context || isFailed) return context;
	if (typeof window === 'undefined') return null;
	const ctor: AudioContextCtor | undefined = window.AudioContext
		?? (window as unknown as {webkitAudioContext?: AudioContextCtor}).webkitAudioContext;
	if (!ctor) {
		isFailed = true;
		return null;
	}
	try {
		context = new ctor();
	} catch (e) {
		console.warn('Audio init failed', e);
		isFailed = true;
	}
	return context;
};

/**
 * Будит контекст. Пока страницу не тронули, браузер держит его приостановленным
 * и на resume отвечает отказом — поэтому вторая попытка ждёт первого нажатия.
 *
 * Уже начатое к этому моменту не теряется: у приостановленного контекста стоит и
 * время, так что тема, заведённая до нажатия, не «уедет» молча, а зазвучит с
 * начала.
 *
 * Подписка разовая: второй раз браузер уже не откажет — тронутой страница
 * считается навсегда.
 */
export const resumeAudio = (): void => {
	const ctx = getAudioContext();
	if (!ctx || ctx.state !== 'suspended') return;
	void ctx.resume();
	waitForGesture();
};

const gestureEvents = ['pointerdown', 'keydown'] as const;
let isWaitingForGesture = false;

const onGesture = (): void => {
	isWaitingForGesture = false;
	for (const event of gestureEvents) document.removeEventListener(event, onGesture);
	if (context && context.state === 'suspended') void context.resume();
};

const waitForGesture = (): void => {
	if (isWaitingForGesture || typeof document === 'undefined') return;
	isWaitingForGesture = true;
	for (const event of gestureEvents) document.addEventListener(event, onGesture);
};
