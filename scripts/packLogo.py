#!/usr/bin/env python3
"""Готовит логотип входа из исходника в images-raw.

Исходник — кадр 1664×928 с неоновой надписью по чёрному: половина кадра пустая,
альфы нет, весит полтора мегабайта. В игре он висит поверх задника (см. Launcher),
поэтому здесь из него делается ровно то, чего в исходнике нет:

  1. убирается лишняя «О» — в надписи их две, а в слове «СОПРОТИВЛЕНИЕ» одна;
  2. кадр обрезается по самому свечению, с полем, чтобы ореол не срезало;
  3. чёрный фон переводится в альфу: mix-blend-mode тут не годится — экраны
     лежат своим слоем над задником, и смешиваться режиму не с чем;
  4. картинка ужимается до ширины, с какой её и показывают.

Перерисовать:

    python3 scripts/packLogo.py

Результат кладётся в src/client/resources/images/logo.png, файл под гитом —
запускать нужно, только когда меняется сам исходник.
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'images-raw', 'logo.png')
TARGET = os.path.join(ROOT, 'src', 'client', 'resources', 'images', 'logo.png')

# Ниже этой яркости считаем, что света нет: по ней ищем и буквы, и края кадра.
GLOW_LEVEL = 24
# Порог, по которому надпись разбирается на буквы: ореолы соседних букв
# смыкаются, а сами штрихи — нет.
STROKE_LEVEL = 200
# Какую букву выкидываем (нумерация с нуля): С-О-О-... — вторая «О».
EXTRA_LETTER = 2
# Поле вокруг свечения и ширина готовой картинки.
PAD = 40
WIDTH = 900


def letter_bounds(image: Image.Image) -> list:
    """Границы букв по столбцам: между ними в надписи тёмные промежутки."""
    lum = np.asarray(image).astype(int).max(axis=2).max(axis=0)
    lit = lum > STROKE_LEVEL
    groups = []
    start = None
    for x, on in enumerate(lit):
        if on and start is None:
            start = x
        if not on and start is not None:
            if x - start > 3:
                groups.append((start, x))
            start = None
    if start is not None:
        groups.append((start, len(lit)))
    return groups


def drop_letter(image: Image.Image, index: int) -> Image.Image:
    """Вырезает букву вместе с её долей промежутков и сдвигает хвост влево.

    Режем по серединам соседних промежутков: там темно, и шов приходится не на
    сам штрих, а на пустое место между буквами.
    """
    letters = letter_bounds(image)
    if index <= 0 or index + 1 >= len(letters):
        raise SystemExit(f'Буквы {index} в надписи нет: найдено {len(letters)}')
    cut_from = (letters[index - 1][1] + letters[index][0]) // 2
    cut_to = (letters[index][1] + letters[index + 1][0]) // 2
    width, height = image.size
    out = Image.new('RGB', (width - (cut_to - cut_from), height))
    out.paste(image.crop((0, 0, cut_from, height)), (0, 0))
    out.paste(image.crop((cut_to, 0, width, height)), (cut_from, 0))
    return out


def to_alpha(image: Image.Image) -> Image.Image:
    """Чёрный фон — это отсутствие света: альфа = яркость пикселя.

    Цвет при этом «распремножаем» обратно, иначе свечение по краям букв выйдет
    блёклым: в исходнике оно уже смешано с чёрным.
    """
    data = np.asarray(image).astype(np.float32)
    alpha = np.clip(data.max(axis=2), 0, 255)
    rgb = np.where(
        alpha[..., None] > 1,
        np.clip(data * 255.0 / np.maximum(alpha[..., None], 1), 0, 255),
        0,
    )
    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA')


def main() -> None:
    source = Image.open(SOURCE).convert('RGB')
    fixed = drop_letter(source, EXTRA_LETTER)

    lum = np.asarray(fixed).astype(int).max(axis=2)
    ys, xs = np.where(lum > GLOW_LEVEL)
    box = (xs.min() - PAD, ys.min() - PAD, xs.max() + PAD, ys.max() + PAD)
    cropped = fixed.crop(box)

    keyed = to_alpha(cropped)
    width, height = keyed.size
    keyed = keyed.resize((WIDTH, round(height * WIDTH / width)), Image.LANCZOS)
    keyed.save(TARGET, optimize=True)
    # Без «×» и прочей типографики: консоль под Windows живёт в cp1251 и на ней
    # падает — сообщение о готовой картинке не должно ронять сборку картинки.
    print('{}: {}x{}, {} KB'.format(TARGET, keyed.size[0], keyed.size[1], os.path.getsize(TARGET) // 1024))


if __name__ == '__main__':
    main()
