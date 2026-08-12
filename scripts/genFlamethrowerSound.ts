/**
 * Синтезирует рёв огнемёта под анимацию сожжения (см. src/client/components/
 * table/Room/Burn.tsx и шейдер в pixiPrimitives/Fire.tsx).
 *
 * Готовой записи у нас нет, а огонь в игре и так считается процедурно — звук
 * сделан тем же способом: шум, фильтры и огибающие. Зато он расписан ровно по
 * таймингу картинки, а не подрезан «на глазок» под неё:
 *
 *   0.00       щелчок поджига;
 *   0.00–2.60  струя (jetPart = 0.5 от burnMs): напор, шипение, турбулентность;
 *   0.42       пламя долетело (burnDelay = 0.08) — низкий «вжух» и вспышка,
 *              ровно в тот кадр, где шейдер рисует ударную волну (mode burst);
 *   0.42–4.15  костёр горит в полную силу; громкость идёт по той же кривой
 *              power, что и яркость пламени в шейдере;
 *   4.15–5.20  огонь опадает, треск редеет;
 *   5.20–5.55  хвост: дым и остывающие угли.
 *
 * Звук нарочно басовый: центр тяжести уведён в 40–200 Гц, под всем костром идёт
 * отдельный подвальный гул (SUB), а шипения и «воздуха» ровно столько, чтобы
 * читался огонь, а не утечка газа. Высокие тут дают шелест, а вес — только низ.
 *
 * Перегенерировать (файл лежит под гитом, запускать только если меняется звук
 * или тайминг анимации):
 *
 *     bun run scripts/genFlamethrowerSound.ts
 */
import {join} from 'path';
import {Biquad, RATE, clamp01, createNoise, master, printEnvelope, smoothstep, writeMp3} from './soundKit';

const ROOT = join(import.meta.dir, '..');
const OUT = join(ROOT, 'src/client/resources/sound/flamethrower.mp3');

// 96 кбит/с моно: шум — материал неблагодарный, на меньшем битрейте треск
// расползается в «булькание», а больше на 5 секунд шума уже не слышно.
const BITRATE = 96;

// Расписание анимации, в секундах: burnMs из client/helpers/burnTiming, jetPart
// и burnDelay из Burn.tsx. Меняется тайминг там — менять надо и здесь.
const BURN = 5.2;
const JET_OFF = BURN * 0.5;
const IGNITE = BURN * 0.08;
// Чуть длиннее костра: дыму и углям надо куда-то догорать.
const DURATION = 5.55;

const TOTAL = Math.round(DURATION * RATE);

const {random, white, wobble} = createNoise(20240607);

// Треск: короткая искра, лопнувшая в огне. Держим только живые.
interface ICrackle {
	start: number;
	freq: number;
	decay: number;
	amp: number;
}

const samples = new Float32Array(TOTAL);

// --- Слои ---------------------------------------------------------------
// Струя: напор (низ), тело и шипение (верх) — три полосы одного шума. Одной
// полосой огнемёт звучит либо как ветер в микрофон, либо как утечка газа.
// Полосы нарочно сдвинуты вниз: огнемёт — это давление, а не свист.
const jetBody = new Biquad();
const jetRoar = new Biquad().bandpass(190, 0.8);
const jetHissHigh = new Biquad().highpass(2600, 0.7);
const jetHissLow = new Biquad().lowpass(7500, 0.7);
// Костёр: подвал, гул и «воздух» над ним.
const fireBody = new Biquad();
const fireLow = new Biquad().bandpass(120, 0.7);
const fireAirHigh = new Biquad().highpass(1600, 0.7);
const fireAirLow = new Biquad().lowpass(6000, 0.7);
// Подвальный гул под всем пожаром: узкая полоса шума около 65 Гц. Именно он даёт
// вес — в тех же 200–500 Гц, сколько их ни добавляй, выходит громче, но не
// мощнее. Резонанс высокий: широкой полосой низ звучит гудением трансформатора.
//
// Ниже 60 Гц гул не опускаем нарочно. Там он есть только в наушниках, а на
// ноутбуке и телефоне пропадает целиком — и весь запас громкости уходит в то,
// чего игрок не услышит, оставляя пожар тихим и глухим.
const subBand = new Biquad().bandpass(65, 2);
const subGuard = new Biquad().lowpass(190, 0.7);
// Поджиг и вспышка.
const clickBand = new Biquad().bandpass(3600, 3.5);
const burstBand = new Biquad().bandpass(800, 0.8);
const burstLow = new Biquad().lowpass(420, 0.9);
// Хвост: дым уходит одним шипением.
const tailBand = new Biquad().bandpass(1300, 0.8);

const jetWobbleSlow = wobble(6);
const jetWobbleFast = wobble(19);
const jetSweep = wobble(3.5);
const fireWobble = wobble(4.5);
const fireSweep = wobble(2.6);
const fireAirWobble = wobble(11);
// Подвал дышит медленнее всего остального: частая дрожь на таких частотах не
// слышна вовсе, а слышен ровный гул.
const subWobble = wobble(1.6);

const crackles: ICrackle[] = [];
// Фаза низкого «вжуха» вспышки: частота у него падает, поэтому её приходится
// накапливать, а не считать от t.
let boomPhase = 0;

for (let i = 0; i < TOTAL; i++) {
	const t = i / RATE;
	let out = 0;

	// Подвальный гул. Фильтры гоняем каждый сэмпл — у них состояние, и кормить их
	// через пропуски нельзя; а раздают этот гул себе уже струя и костёр, каждый со
	// своим весом.
	//
	// Полоса узкая, поэтому от белого шума она пропускает совсем немного, и низ
	// приходится сначала сильно усилить, а потом ограничить. Ограничение здесь не
	// ради громкости: у узкополосного шума размах случаен, валами, и подвал без
	// выравнивания тянет за собой громкость всей сцены — вместо ровного гула звук
	// начинает раскачиваться. Заодно насыщение добавляет к 52 Гц гармоники на 104 и
	// 156, а на телефонном динамике только они от подвала и остаются.
	const sub = Math.tanh(subGuard.process(subBand.process(white())) * 24)
		* 0.5 * (0.82 + 0.3 * subWobble());

	// 1. Щелчок поджига: два коротких удара пьезо. Без них струя начинается
	// «из ниоткуда» — а огнемёт сначала щёлкает, и только потом бьёт.
	for (const clickAt of [0, 0.042]) {
		const u = t - clickAt;
		if (u < 0 || u > 0.05) continue;
		out += clickBand.process(white()) * Math.exp(-u / 0.004) * 0.5;
	}

	// 2. Струя. Живёт первую половину костра — ровно столько, сколько её рисует
	// Fire (mode jet, jetLife).
	if (t < JET_OFF + 0.12) {
		// Быстрая атака с «пыхом» в самом начале: так слышно, что клапан открыли
		// разом, а не плавно вывели громкость.
		const attack = smoothstep(0, 0.05, t) * (1 + 0.55 * Math.exp(-t / 0.07));
		const release = 1 - smoothstep(JET_OFF - 0.3, JET_OFF + 0.1, t);
		const turbulence = 0.62 + 0.5 * jetWobbleSlow() + 0.16 * (jetWobbleFast() - 0.5);
		const env = attack * release * turbulence;
		if (env > 0) {
			// Срез тела всё время плывёт: неподвижный фильтр даёт «белый шум под
			// одеялом», а плывущий — живой поток. Срез низкий: выше килогерца струя
			// начинает свистеть, а нужен напор.
			jetBody.lowpass(700 + 600 * jetSweep(), 0.9);
			const body = jetBody.process(white()) * 0.9;
			const roar = jetRoar.process(white()) * 1.25;
			// Шипения ровно столько, чтобы слышалось пламя, а не один только гул.
			const hiss = jetHissLow.process(jetHissHigh.process(white())) * (0.1 + 0.12 * jetWobbleFast());
			out += (body + roar + hiss) * env * 0.8 + sub * env * 0.4;
		}
	}

	// 3. Пламя долетело: низкий «вжух» и вспышка. Тот же миг, что и mode burst.
	const sinceIgnite = t - IGNITE;
	if (sinceIgnite >= 0 && sinceIgnite < 1.2) {
		const u = sinceIgnite;
		// Частота падает — так удар читается как объёмный хлопок, а не как «бип».
		// Уходит он глубоко (до 30 Гц) и держится долго: короткий высокий удар
		// слышен щелчком, а этот должен ударить в грудь.
		boomPhase += 2 * Math.PI * (30 + 62 * Math.exp(-u / 0.24)) / RATE;
		out += Math.sin(boomPhase) * Math.exp(-u / 0.28) * (1 - Math.exp(-u / 0.006)) * 1;
		out += burstBand.process(white()) * Math.exp(-u / 0.1) * 0.45;
		out += burstLow.process(white()) * (1 - Math.exp(-u / 0.025)) * Math.exp(-u / 0.42) * 0.75;
	}

	// 4. Костёр. Громкость — по той же кривой power, что и яркость пламени в
	// шейдере: звук опадает вместе с картинкой, а не сам по себе.
	if (sinceIgnite >= 0) {
		const life = clamp01(sinceIgnite / (BURN - IGNITE));
		const power = smoothstep(0, 0.12, life) * (1 - smoothstep(0.78, 1, life));
		if (power > 0) {
			const breath = 0.68 + 0.55 * fireWobble();
			// Тело костра сидит в 300–560 Гц: это гул большого огня. Выше начинается
			// шелест горящей бумаги, и от него пламя кажется мелким.
			fireBody.lowpass(300 + 260 * fireSweep(), 1);
			const body = fireBody.process(white()) * 1;
			// Полоса около 120 Гц — то, чем пожар бьёт в грудь. На ней держится
			// мощность и тогда, когда подвала слушателю не слышно.
			const low = fireLow.process(white()) * 1.5;
			const air = fireAirLow.process(fireAirHigh.process(white())) * (0.06 + 0.09 * fireAirWobble());
			// Костёр громче струи: она отхлестала и смолкла на середине, а гореть
			// игроку до самого конца — на обрыве струи звук не должен проваливаться.
			out += (body + low + air) * power * breath * 1.2 + sub * power * 0.5;

			// Треск: искры лопаются тем чаще, чем сильнее горит. Это то, что
			// отличает костёр от гудящей горелки.
			//
			// Частота падает не как power, а как её куб, и ниже порога треск
			// прекращается вовсе. Причина слышимая: когда гул уже опал, редкий
			// одиночный щелчок остаётся в тишине один и слышится не костром, а
			// капающей водой. Треску положено кончиться раньше пламени, а не
			// доживать за ним.
			if (power > 0.45 && random() < (52 * power * power * power) / RATE) {
				crackles.push({
					start: t,
					// Ниже полутора килогерц щелчок получает различимую высоту и
					// звучит каплей — держим его в шумовой, «дровяной» полосе.
					freq: 1600 + random() * 3000,
					decay: 0.001 + random() * 0.0035,
					amp: (0.06 + random() * random() * 0.44) * power,
				});
			}
		}
	}

	// 5. Хвост: дым и остывающие угли после того, как пламя опало.
	if (t > BURN - 1.1) {
		const u = t - (BURN - 1.1);
		out += tailBand.process(white()) * Math.exp(-u / 0.8) * 0.12;
	}

	// Лопнувшие искры. Шум с небольшой подмесью тона: чистый шумовой импульс
	// слышен как цифровой «клик», а чистый тон — как капля, поэтому шума здесь
	// заметно больше, чем синуса.
	for (let k = crackles.length - 1; k >= 0; k--) {
		const crackle = crackles[k];
		if (!crackle) continue;
		const u = t - crackle.start;
		if (u > crackle.decay * 8) {
			crackles.splice(k, 1);
			continue;
		}
		const tone = Math.sin(2 * Math.PI * crackle.freq * u) * 0.25 + white() * 0.75;
		out += tone * Math.exp(-u / crackle.decay) * crackle.amp;
	}

	samples[i] = out;
}

// Срез ниже 24 Гц: выше резать нельзя — там живёт весь вес пожара.
const pcm = master(samples, {dcCutHz: 24, drive: 0.9, peak: 0.89, fadeInSec: 0.004, fadeOutSec: 0.09});

// Баланс низа и верха: раз звук делается басовым, эту меру надо видеть, а не
// угадывать. Считаем по готовому PCM, разделив его на 200 Гц.
const bassSplit = new Biquad().lowpass(200, 0.7);
const trebleSplit = new Biquad().highpass(200, 0.7);
let bassEnergy = 0;
let trebleEnergy = 0;
for (let i = 0; i < TOTAL; i++) {
	const value = (pcm[i] ?? 0) / 32767;
	bassEnergy += bassSplit.process(value) ** 2;
	trebleEnergy += trebleSplit.process(value) ** 2;
}
const bassRms = Math.sqrt(bassEnergy / TOTAL);
const trebleRms = Math.sqrt(trebleEnergy / TOTAL);
console.log(`Баланс: до 200 Гц ${bassRms.toFixed(3)}, выше ${trebleRms.toFixed(3)}`
	+ ` (низа в ${(bassRms / trebleRms).toFixed(1)} раза больше)`);

printEnvelope(pcm, 0.15);
const bytes = await writeMp3(OUT, pcm, BITRATE);
console.log(`Flamethrower sound -> ${OUT} (${DURATION.toFixed(2)}s, ${(bytes / 1024).toFixed(1)} KB)`);
