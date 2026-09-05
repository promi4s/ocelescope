from dataclasses import dataclass, field
from types import MethodType, NoneType, UnionType
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    Callable,
    Literal,
    Union,
    get_args,
    get_origin,
    get_type_hints,
)

from ocelescope import OCEL
from ocelescope.plugin.input import PluginInput
from ocelescope.resource.resource import Resource

if TYPE_CHECKING:
    from ocelescope.plugin.plugin import Plugin


@dataclass
class Annotation:
    label: str
    description: str | None = None
    is_optional: bool = False


class OCELAnnotation(Annotation):
    """UI annotation metadata for an `OCEL`-typed parameter or result.

    In addition to the base `Annotation` fields, this annotation may specify an
    OCEL extension. To keep the annotation JSON-serializable and stable for
    frontend consumption, the constructor accepts an `OCELExtension` class and
    coerces it to its class name (a string).

    Attributes:
        label: Human-readable label to display in the UI.
        description: Optional longer text shown in the UI to explain the OCEL.
        extension: Optional extension identifier. If constructed with an
            `OCELExtension` class, it is coerced to that class' name.

    """

    pass


class ResourceAnnotation(Annotation):
    """UI annotation metadata for a `Resource`-typed parameter or result.

    This annotation is used to provide frontend-facing text (label/description)
    for resources.

    Attributes:
        label: Human-readable label to display in the UI.
        description: Optional longer text shown in the UI to explain the resource.
    """

    annotation_resources: list[type[Resource]] | None = None


def _unwrap_annotated(typ) -> tuple[Any, Annotation | None]:
    if get_origin(typ) is not Annotated:
        return typ, None

    base_type, *annotations = get_args(typ)
    return base_type, next((a for a in annotations if isinstance(a, Annotation)), None)


def _unwrap_optional(typ) -> tuple[Any, bool]:
    """Strip the `None` from `T | None` / `Optional[T]`; other unions are rejected."""
    if get_origin(typ) not in (Union, UnionType):
        return typ, False

    args = get_args(typ)
    non_none = [arg for arg in args if arg is not NoneType]

    if len(non_none) != 1 or len(non_none) == len(args):
        raise TypeError(f"Unsupported union type: {typ}. Only `T | None` is supported.")

    return non_none[0], True


def extract_info(typ) -> tuple[type, Annotation | None, bool]:
    """Peel `Annotated[...]` and `| None` off a hint.

    Returns the base type, its `Annotation` (if any) and whether it was optional.
    The annotation may sit on either side of the union, so both
    `Annotated[OCEL | None, ...]` and `Annotated[OCEL, ...] | None` are accepted.
    """
    base_type, annotation = _unwrap_annotated(typ)
    base_type, is_optional = _unwrap_optional(base_type)
    base_type, inner_annotation = _unwrap_annotated(base_type)

    return (
        base_type,
        annotation if annotation is not None else inner_annotation,
        is_optional,
    )


class PluginIO:
    def __init__(self, name: str, io_type: Any):
        base_class, annotation, is_optional = extract_info(io_type)

        self.is_list = False
        if get_origin(base_class) is list:
            base_class, _, _ = extract_info(get_args(base_class)[0])
            self.is_list = True

        if not isinstance(base_class, type) or not issubclass(base_class, (OCEL, Resource)):
            target = f"parameter {name!r}" if name else "the return type"
            raise TypeError(
                f"Unsupported type for {target}: {io_type!r}. Plugin inputs and outputs must be "
                f"`OCEL` or a `Resource` subclass, optionally wrapped in `list[...]`, `T | None` "
                f"or `Annotated[...]`."
            )

        self.name = name
        self.type: type[OCEL] | type[Resource] = base_class
        self.is_optional = is_optional

        is_annotation = isinstance(annotation, Annotation)

        self.label = annotation.label if is_annotation else self.name
        self.description = annotation.description if is_annotation else None

        self.annotated_resources = (
            annotation.annotation_resources if isinstance(annotation, ResourceAnnotation) else []
        ) or []

    @property
    def resource_types(self):
        return ([self.type] if issubclass(self.type, Resource) else []) + self.annotated_resources

    @property
    def io_type(self) -> Literal["ocel", "resource"]:
        return "ocel" if issubclass(self.type, OCEL) else "resource"

    def __repr__(self) -> str:
        return str(
            {
                "name": self.name,
                "type": self.type,
                "label": self.label,
                "description": self.description,
                "is_optional": self.is_optional,
                "is_list": self.is_list,
            }
        )


PluginReturnItemType = Union[OCEL, Resource, list[OCEL], list[Resource]]
PluginReturnType = Union[tuple[PluginReturnItemType], PluginReturnItemType]


@dataclass
class PluginMethod:
    name: str
    label: str
    method: Callable[..., PluginReturnType]
    description: str | None
    inputs: list[PluginIO] = field(default_factory=list)
    outputs: list[PluginIO] = field(default_factory=list)
    configuration_input: type[PluginInput] | None = None

    def bind(self, plugin: "Plugin") -> Callable[..., PluginReturnType]:
        """Bind this method to a plugin instance.

        `method` is captured while the class body is still executing, so it is a
        plain function that still expects `self`. Binding it to `plugin` yields the
        callable a plugin run actually needs.
        """
        return MethodType(self.method, plugin)


def plugin_method(
    label: str | None = None,
    description: str | None = None,
):
    """Decorator that marks a plugin class method as an Ocelescope runnable function.

    Args:
        label: Human-readable label shown in the UI for the method. If not provided,
            the UI may fall back to the Python method name.
        description: Human-readable description shown in the UI for the method.

    """

    def decorator(func: Callable[..., PluginReturnType]):
        plugin_method_meta = PluginMethod(
            name=func.__name__,  # ty: ignore[unresolved-attribute]
            label=label or func.__name__,  # ty: ignore[unresolved-attribute]
            description=description,
            method=func,
        )

        for key, value in get_type_hints(func, include_extras=True).items():
            if key == "return":
                return_origin = get_origin(value)

                types_to_parse = []

                if return_origin is tuple:
                    types_to_parse = get_args(value)
                else:
                    types_to_parse = [value]

                plugin_method_meta.outputs = [
                    PluginIO("", return_item) for return_item in types_to_parse
                ]

            elif isinstance(base_type := extract_info(value)[0], type) and issubclass(
                base_type, PluginInput
            ):
                plugin_method_meta.configuration_input = value
            else:
                plugin_method_meta.inputs += [PluginIO(name=key, io_type=value)]

        setattr(
            func,
            "__meta__",
            plugin_method_meta,
        )

        return func

    return decorator
