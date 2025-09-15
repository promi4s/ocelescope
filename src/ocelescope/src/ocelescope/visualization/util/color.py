import matplotlib.pyplot as plt
import matplotlib.colors as mcolors


def generate_color_map(strings: list[str], scale="Pastel2"):
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

    cmap = plt.cm.get_cmap(scale, len(unique_strings))

    palette = [mcolors.to_hex(cmap(i)) for i in range(len(unique_strings))]

    return {s: c for s, c in zip(unique_strings, palette)}
