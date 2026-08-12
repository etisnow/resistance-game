/**
 * Синтезирует отражённый огнемёт — звук карты «Никакого шашлыка!».
 *
 * Это тот же выстрел, что в genFlamethrowerSound, только он ни во что не
 * попадает: струя бьёт в металл, звенит по нему и захлёбывается. Никакого костра
 * дальше нет, потому что и на столе его нет — при отражении сервер не создаёт
 * события сожжения (см. noFire в server/helpers/cardActions/offense/flamethrower),
 * и стол показывает только карту над бейджем.
 *
 *   0.00       щелчок поджига;
 *   0.00–0.85  струя — короткая: попадать ей некуда;
 *   0.34       удар в металл: звон с биениями, глухой толчок и брызги пламени
 *              в стороны;
 *   0.34–1.60  металл звенит и стихает, по нему шипит скатившееся пламя;
 *   0.85       клапан закрыли — струя обрывается коротким пыхом;
 *   1.60–2.00  остаточное шипение.
 *
 * Тембр струи (полосы и веса) повторяет огнемётный нарочно: это один и тот же
 * огнемёт, и звучать он должен одинаково. Вынести его в общий модуль нельзя без
 * пересборки flamethrower.mp3 — у синтеза детерминированный шум, и лишний вызов
 * генератора сдвинул бы всю последовательность, то есть переписал бы готовый и
 * принятый звук.
 *
 * Перегенерировать (файл лежит под гитом, запускать только если меняется звук):
 *
 *     bun run scripts/genNoFireSound.ts
 */
import {join} from 'path';
import {Biquad, RATE, createNoise, master, printEnvelope, smoothstep, writeMp3} from './soundKit';

const OUT = join(import.meta.dir, '..', 'src/client/resources/sound/noFire.mp3');
const BITRATE = 112;
const DURATION = 2;
const TOTAL = Math.round(DURATION * RATE);

// Когда струя доходит до металла и сколько всего хлещет.
const IMPACT = 0.34;
const JET_OFF = 0.85;

/**
 * Моды листа металла. Частоты нарочно не гармонические: у гармонического ряда
 * получается колокол или гонг, а лист звенит именно несоразмерными тонами.
 * Каждая мода звучит парой чуть разведённых тонов — от этого идут биения, и звон
 * получается живым, а не электронным писком.
 */
const modes: {freq: number; decay: number; amp: number}[] = [
	{freq: 1180, decay: 0.6, amp: 0.5},
	{freq: 1642, decay: 0.45, amp: 0.36},
	{freq: 2337, decay: 0.32, amp: 0.26},
	{freq: 3120, decay: 0.22, amp: 0.18},
	{freq: 4410, decay: 0.16, amp: 0.1},
];
// Насколько разведены тоны в паре.
const BEAT = 1.006;

const {white, wobble} = createNoise(31415926);

// Струя: те же три полосы, что у огнемёта.
const jetBody = new Biquad();
const jetRoar = new Biquad().bandpass(190, 0.8);
const jetHissHigh = new Biquad().highpass(2600, 0.7);
const jetHissLow = new Biquad().lowpass(7500, 0.7);
// Подвальный гул под струёй: узкая полоса, усиленная и ограниченная, — тот же
// приём, что в огнемёте (иначе низа в узкой полосе почти нет, а без ограничения
// он идёт случайными валами).
const subBand = new Biquad().bandpass(65, 2);
const subGuard = new Biquad().lowpass(190, 0.7);
// Удар в металл: яркий фронт, брызги пламени по листу и шипение на нём.
const clangHigh = new Biquad().highpass(4000, 0.7);
const spray = new Biquad();
const sizzle = new Biquad().highpass(3500, 0.7);
// Закрытый клапан: короткий глухой пых.
const puffLow = new Biquad().lowpass(500, 0.9);

const jetSweep = wobble(3.5);
const jetWobbleSlow = wobble(6);
const jetWobbleFast = wobble(19);
const subWobble = wobble(1.6);
const sizzleWobble = wobble(13);

const samples = new Float32Array(TOTAL);

for (let i = 0; i < TOTAL; i++) {
	const t = i / RATE;
	let out = 0;
	const sub = Math.tanh(subGuard.process(subBand.process(white())) * 24)
		* 0.5 * (0.82 + 0.3 * subWobble());

	// 1. Щелчок поджига.
	for (const clickAt of [0, 0.042]) {
		const u = t - clickAt;
		if (u < 0 || u > 0.05) continue;
		out += clangHigh.process(white()) * Math.exp(-u / 0.004) * 0.45;
	}

	// 2. Струя. Обрывается она резче, чем у огнемёта: там струю ведут по цели, а
	// здесь сразу видно, что горит не жертва, а железо, и клапан закрывают.
	if (t < JET_OFF + 0.1) {
		const attack = smoothstep(0, 0.05, t) * (1 + 0.55 * Math.exp(-t / 0.07));
		const release = 1 - smoothstep(JET_OFF - 0.16, JET_OFF + 0.04, t);
		const turbulence = 0.62 + 0.5 * jetWobbleSlow() + 0.16 * (jetWobbleFast() - 0.5);
		const env = attack * release * turbulence;
		if (env > 0) {
			jetBody.lowpass(700 + 600 * jetSweep(), 0.9);
			const body = jetBody.process(white()) * 0.9;
			const roar = jetRoar.process(white()) * 1.25;
			const hiss = jetHissLow.process(jetHissHigh.process(white())) * (0.1 + 0.12 * jetWobbleFast());
			// Вес струи выше огнемётного (там 0.8): нормировку тут задаёт удар по
			// железу, и при огнемётном весе струю в этом звуке едва слышно — а
			// узнаваться должен именно выстрел из огнемёта.
			out += (body + roar + hiss) * env * 1.45 + sub * env * 0.55;
		}
	}

	// 3. Удар в металл — то, чем этот звук и отличается от сожжения.
	const sinceImpact = t - IMPACT;
	if (sinceImpact >= 0) {
		const u = sinceImpact;
		// Фронт: сам щелчок железа. Без него звон начинается «сам собой», и
		// слышно не удар, а включённый синтезатор.
		out += clangHigh.process(white()) * Math.exp(-u / 0.0025) * 0.7;
		// Лист принял удар: глухой низкий толчок с падающей высотой.
		out += Math.sin(2 * Math.PI * (70 + 34 * Math.exp(-u / 0.04)) * u) * Math.exp(-u / 0.13) * 0.55;
		for (const mode of modes) {
			const ring = Math.exp(-u / mode.decay) * mode.amp;
			out += Math.sin(2 * Math.PI * mode.freq * u) * ring;
			out += Math.sin(2 * Math.PI * mode.freq * BEAT * u) * ring * 0.55;
		}
		// Брызги: пламя расходится по листу веером. Полоса едет вверх — так слышно,
		// что огонь разлетается, а не глохнет на месте.
		spray.bandpass(900 + 1700 * smoothstep(0, 0.18, u), 0.8);
		out += spray.process(white()) * (1 - Math.exp(-u / 0.008)) * Math.exp(-u / 0.22) * 0.8;
		// И шипит на железе, пока не стечёт.
		out += sizzle.process(white()) * Math.exp(-u / 0.55) * (0.16 + 0.12 * sizzleWobble());
	}

	// 4. Клапан закрыли: коротко пыхнуло остатками в стволе.
	const sinceOff = t - JET_OFF;
	if (sinceOff >= 0 && sinceOff < 0.4) {
		out += puffLow.process(white()) * (1 - Math.exp(-sinceOff / 0.01)) * Math.exp(-sinceOff / 0.09) * 0.35;
	}

	samples[i] = out;
}

const pcm = master(samples, {dcCutHz: 26, drive: 0.9, peak: 0.89, fadeInSec: 0.003, fadeOutSec: 0.08});
printEnvelope(pcm, 0.1, 85);
const bytes = await writeMp3(OUT, pcm, BITRATE);
console.log(`No-fire sound -> ${OUT} (${DURATION.toFixed(2)}s, ${(bytes / 1024).toFixed(1)} KB)`);
