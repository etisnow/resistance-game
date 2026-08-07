import {ANALYTICS_CONTRACT_VERSION, type IAnalyticsMatch} from 'shared/analytics/contract';
import {appendFileSync, mkdirSync} from 'fs';
import {dirname} from 'path';

// Куда отправлять партии. Пусто — аналитика выключена: движок всё равно всё
// пишет в память (это дёшево), но наружу ничего не уходит. Так ведут себя
// юнит-тесты, e2e и любой запуск без аналитического сервиса.
const ANALYTICS_URL = () => (process.env.ANALYTICS_URL || '').replace(/\/+$/, '');
const ANALYTICS_TOKEN = () => process.env.ANALYTICS_TOKEN || '';
// Файл-подстраховка: партии, которые так и не удалось отправить, дописываются
// сюда построчным JSON, и их можно залить руками (`./run analytics import`).
const ANALYTICS_SPOOL = () => process.env.ANALYTICS_SPOOL || '';

// Сколько раз пробуем отправить партию и с какой задержкой (мс).
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS = [1_000, 5_000, 15_000, 60_000];
// Больше партий в очереди держать незачем: за столом их появляется единицы в час.
const MAX_QUEUE = 200;
const REQUEST_TIMEOUT_MS = 10_000;

interface IQueueItem {
	match: IAnalyticsMatch;
	attempts: number;
}

/**
 * Очередь отправки законченных партий в аналитический центр.
 *
 * Правила простые: игра важнее статистики. Отправка асинхронная, ошибки только
 * логируются, очередь ограничена, при полном провале партия уходит в спул-файл.
 */
class AnalyticsSink {
	private queue: IQueueItem[] = [];
	private timer: ReturnType<typeof setTimeout> | null = null;
	private sending = false;
	/** Тестовый крючок: сюда попадает каждая законченная партия. */
	onMatch: ((match: IAnalyticsMatch) => void) | null = null;
	/** Счётчики для /healthz и отладки. */
	stats = {queued: 0, sent: 0, failed: 0, spooled: 0, dropped: 0};

	isEnabled() {
		return !!ANALYTICS_URL();
	}

	submit(match: IAnalyticsMatch) {
		try {
			if (this.onMatch) this.onMatch(match);
			if (!this.isEnabled()) return;
			if (this.queue.length >= MAX_QUEUE) {
				this.stats.dropped += 1;
				console.error('[analytics] очередь переполнена, партия отброшена', match.matchId);
				return;
			}
			this.queue.push({match, attempts: 0});
			this.stats.queued += 1;
			this.schedule(0);
		} catch (e) {
			console.error('[analytics] submit упал:', e);
		}
	}

	private schedule(delay: number) {
		if (this.timer || this.sending) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flush();
		}, delay);
		// Отправка статистики не должна держать процесс живым при выходе.
		if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
			(this.timer as {unref: () => void}).unref();
		}
	}

	private async flush(): Promise<void> {
		if (this.sending) return;
		this.sending = true;
		try {
			while (this.queue.length > 0) {
				const item = this.queue[0];
				if (!item) {
					this.queue.shift();
					continue;
				}
				const ok = await this.send(item.match);
				if (ok) {
					this.queue.shift();
					this.stats.sent += 1;
					continue;
				}
				item.attempts += 1;
				this.stats.failed += 1;
				if (item.attempts >= MAX_ATTEMPTS) {
					this.queue.shift();
					this.spool(item.match);
					continue;
				}
				const delay = RETRY_DELAYS[Math.min(item.attempts - 1, RETRY_DELAYS.length - 1)] ?? 60_000;
				this.sending = false;
				this.schedule(delay);
				return;
			}
		} finally {
			this.sending = false;
		}
	}

	private async send(match: IAnalyticsMatch): Promise<boolean> {
		const url = `${ANALYTICS_URL()}/api/ingest`;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${ANALYTICS_TOKEN()}`,
				},
				body: JSON.stringify({version: ANALYTICS_CONTRACT_VERSION, matches: [match]}),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			if (!response.ok) {
				const text = await response.text().catch(() => '');
				console.error(`[analytics] ingest ответил ${response.status}: ${text.slice(0, 200)}`);
				// 4xx (кроме 429) — запрос кривой, повторять смысла нет.
				return response.status >= 400 && response.status < 500 && response.status !== 429;
			}
			return true;
		} catch (e) {
			console.error('[analytics] не удалось отправить партию:', e instanceof Error ? e.message : e);
			return false;
		}
	}

	// Последний рубеж: партия ложится в файл, чтобы её не потерять совсем.
	private spool(match: IAnalyticsMatch) {
		const path = ANALYTICS_SPOOL();
		if (!path) {
			this.stats.dropped += 1;
			console.error('[analytics] партия потеряна (спул не настроен)', match.matchId);
			return;
		}
		try {
			mkdirSync(dirname(path), {recursive: true});
			appendFileSync(path, `${JSON.stringify(match)}\n`, 'utf8');
			this.stats.spooled += 1;
		} catch (e) {
			this.stats.dropped += 1;
			console.error('[analytics] спул недоступен, партия потеряна:', e);
		}
	}
}

export const analyticsSink = new AnalyticsSink();
