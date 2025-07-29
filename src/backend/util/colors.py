import hashlib
import colorsys


def string_to_vibrant_color(string: str):
    # Create a stable hash from the string
    hash_int = int(hashlib.sha1(string.encode()).hexdigest(), 16)

    # Use hash to pick a hue on the color wheel
    hue = (hash_int % 360) / 360.0

    # High saturation and medium lightness = vibrant color
    saturation = 0.95  # close to max
    lightness = 0.5  # not too light or dark

    # Convert HSL to RGB
    r, g, b = colorsys.hls_to_rgb(hue, lightness, saturation)

    # Convert RGB [0–1] to hex
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


def generate_color_map(strings: list[str]):
    return {s: string_to_vibrant_color(s) for s in strings}
