from typing import Literal

import matplotlib.colors as mcolors
import matplotlib.pyplot as plt


def generate_color_map(strings: list[str], scale: str | Literal["custom"] = "Pastel2"):
    """
    Assigns each unique string a color from the palette, in sorted order.
    No hashing → deterministic, order of input list doesn't matter.

    Args:
        strings (list[str]): List of strings.
        scale (str): Matplotlib colormap name.

    Returns:
        dict[str, str]: Mapping of strings to hex colors.
    """
    unique_strings = sorted(set(strings))  # order independent

    if scale == "custom":
        palette = [
            "#00616599",  # petrol
            "#CE108A99",  # pink
            "#0098A199",  # turquoise
            "#F6A80099",  # orange
            "#00549F99",  # blue
            "#6f2b4b99",  # purple
            "#8EBAE599",  # light blue
            "#00008099",  # dark blue
            "#007e5699",  # lighter greeny-turquoise
            "#005d4c99",  # perl-ophal green
            "#a1dfd799",  # light-turquoise
            "#cd00cd99",  # pink
            "#28713e99",  # green
            "#701f2999",  # purpur-red
            "#5d214199",  # other purple
            "#00ffff99",  # cyan
            "#39ff1499",  # neon green
            "#80008099",  # purpur
            "#005f6a99",  # blue-petrol
            "#76e1e099",  # another turquoise
            "#f5ff0099",  # neon-yellow
        ]
    else:
        cmap = plt.cm.get_cmap(scale, len(unique_strings))
        palette = [mcolors.to_hex(cmap(i)) for i in range(len(unique_strings))]

    return {s: c for s, c in zip(unique_strings, palette)}
