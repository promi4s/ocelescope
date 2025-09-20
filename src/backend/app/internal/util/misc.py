import os
import re
import time
from typing import Callable, Hashable, Iterable, Literal, TypeVar

import numpy as np
from pydantic_settings import BaseSettings

from app.internal.logger import logger
from app.internal.util.types import PathLike


def pluralize(
    count: int,
    *,
    sg: str | None = None,
    pl: str | None = None,
    mode: Literal["word", "num_word"] = "num_word",
):
    if pl is None:
        raise ValueError
    if sg is None:
        if not pl.endswith("s"):
            raise ValueError
        if pl.endswith("ies"):
            sg = pl[:-3] + "y"
        else:
            sg = pl[:-1]

    w = sg if count == 1 else pl
    if mode == "num_word":
        return f"{count} {w}"
    if mode == "word":
        return w


T = TypeVar("T", bound=Hashable)


def unique(xs: Iterable[T]):
    return list(dict.fromkeys(xs))


def unnest_dict(d: dict, keys=[]):
    result = {}
    for k, v in d.items():
        if isinstance(v, dict):
            result.update(unnest_dict(v, keys + [k]))
        else:
            result[tuple(keys + [k])] = v
    return result


def set_str(xs: list[str] | set[str], empty_rep: str = "---"):
    """Joins a set or list to a comma-separated string of unique elements, or "---" if empty."""
    if isinstance(xs, list):
        # Keep unique elements but preserve order
        xs = list(dict.fromkeys(xs))
    elif isinstance(xs, set):
        xs = sorted(xs)

    return ", ".join(xs) if xs else empty_rep


def set_from_str(s: str, empty_rep: str = "---"):
    """Reverse operation of `set_str`"""
    if s == empty_rep:
        return set()
    return set(s.split(", "))


def indent(s: str, n: int) -> str:
    return "\n".join([(n * "  ") + line for line in s.split("\n")])


re_camel_case = re.compile(r"[_\-]+")
re_snake_case = re.compile(r"(?<!^)(?=[A-Z])")


def camel_case(s: str) -> str:
    """Converts a string from snake_case to (lower) camelCase"""
    s = re_camel_case.sub(" ", s).title().replace(" ", "")
    return "".join([s[0].lower(), *s[1:]])


def snake_case(s: str) -> str:
    """Converts a string from camelCase to snake_case"""
    return re_snake_case.sub("_", s).lower()


def all_or_none(__iterable: Iterable[object], /):
    """Returns true iff an iterable either has only truthy or only falsy values. For an empty input, returns true."""
    return all(__iterable) or not any(__iterable)


def exactly_one(__iterable: Iterable[object], /):
    """Returns true iff an iterable has exactly one truthy value. For an empty input, returns false."""
    iterator = iter(__iterable)
    has_true = any(iterator)
    has_another_true = any(iterator)
    return has_true and not has_another_true


def example_settings_to_dotenv(
    settings_class: type[BaseSettings], /, include_metadata: bool = False
) -> str:
    """Create `.env.example` from settings class.
    Source: https://github.com/pydantic/pydantic/discussions/3073#discussioncomment-8685895"""
    from pydantic_core import PydanticUndefined

    try:
        # This prints `int` instead of `<class int>
        from typing import _type_repr as type_repr
    except ImportError:
        type_repr = repr  # type: ignore[assignment]

    output = []
    env_prefix = settings_class.model_config["env_prefix"]  # type: ignore
    for field_name, model_field in settings_class.model_fields.items():
        env_var_name = f"{env_prefix}{field_name}"
        is_required = model_field.is_required()
        has_default = model_field.default is not PydanticUndefined

        if model_field.validation_alias is not None:
            if isinstance(model_field.validation_alias, str):
                env_var_name = model_field.validation_alias
            else:
                logger.error(
                    "Unsupported validation alias type '%s'",
                    type(model_field.validation_alias),
                )

        # Description
        if model_field.description:
            for line in model_field.description.split("\n"):
                if line.strip():
                    output.append(f"# {line.strip()}")  # noqa: PERF401

        # Examples and possible values
        if model_field.annotation.__class__.__name__ == "_LiteralGenericAlias":
            # A Literal, so we have only a fixed set of possible values
            possible_values = model_field.annotation.__args__  # type: ignore[union-attr]
            possible_values_string = ", ".join(possible_values)
            output.append(f"# Possible values: {possible_values_string}")
        elif model_field.examples:
            # Examples
            if isinstance(model_field.examples, list):
                example_string = ", ".join(str(item) for item in model_field.examples)
            else:
                example_string = str(model_field.examples)
            output.append(f"# Example values: {example_string}")

        # Metadata
        if include_metadata:
            metadata = []
            field_type = f"{type_repr(model_field.annotation)}"
            metadata.append("required" if is_required else "not required")
            metadata.append(f"type: '{field_type}'")
            if has_default and model_field.default is not None:
                metadata.append(f"default: '{model_field.default}'")
            output.append(f"# Metadata: {', '.join(metadata)}")

        # Only leave fields uncommented which need a user defined value
        needs_user_defined_value = is_required and not has_default
        line_prefix = "" if needs_user_defined_value else "# "
        value = (
            str(model_field.default)
            if has_default and model_field.default is not None
            else ""
        )

        output.append(f"{line_prefix}{env_var_name.upper()}={value}")
        output.append("")

    return "\n".join(output)


def export_example_settings_as_dotenv(
    settings_class: type[BaseSettings], /, path: PathLike = ".env.example"
):
    """Create `.env.example` from settings class.
    Source: https://github.com/pydantic/pydantic/discussions/3073#discussioncomment-8685895"""
    if write_file_if_changed(path, example_settings_to_dotenv(settings_class)):
        logger.info(f"Config structure changed - Exported to {path}.")


def write_file_if_changed(path: PathLike, content: str) -> bool:
    """Writes a string to a file, overriding the file if it exists. Returns True iff the file has changed."""
    prev = None
    if os.path.exists(path):
        with open(path, "r") as f:
            prev = f.read()
    if prev == content:
        return False
    with open(path, "w") as f:
        f.write(content)
    return True


class Timer:
    # https://stackoverflow.com/a/69156219/15936336
    def __init__(
        self,
        timer: Callable[[], float] = time.process_time,
        output: bool = False,
    ):
        self.timer = timer
        self.output = output
        self.time = np.nan
        self._entered = 0

    def __enter__(self):
        self._entered += 1
        if self._entered == 1:
            self.start = self.timer()
        return self

    def __exit__(self, type, value, traceback):
        self._entered -= 1
        assert self._entered >= 0
        if self._entered == 0:
            if np.isnan(self.time):
                self.time = 0
            self.time += self.timer() - self.start
            self.readout = f"Time: {self.time:.3f} seconds"
            if self.output:
                print(self.readout)
