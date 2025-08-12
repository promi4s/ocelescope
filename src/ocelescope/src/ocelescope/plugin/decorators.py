from functools import cached_property
from typing import (
    Annotated,
    Any,
    Callable,
    Literal,
    Optional,
    TypeAlias,
    Union,
    get_args,
    get_origin,
    get_type_hints,
    overload,
)

from pydantic import BaseModel, Field, PrivateAttr, computed_field

from ocelescope.ocel.extension import OCELExtension
from ocelescope.ocel.ocel import OCEL
from ocelescope.plugin.input import PluginInput
from ocelescope.resource.resource import Resource


# region Plugin Metadata
class PluginMeta(BaseModel):
    name: str
    version: str
    label: str
    description: Optional[str]


def plugin_meta(
    name: Optional[str] = None,
    version: str = "1.0",
    label: Optional[str] = None,
    description: Optional[str] = None,
):
    def decorator(cls):
        cls.__meta__ = PluginMeta(
            name=name or cls.__name__,
            version=version,
            label=label or cls.__name__,
            description=description,
        )
        return cls

    return decorator


# endregion


# region Plugin Method
class Annotation(BaseModel):
    label: str
    description: Optional[str] = None


class OCELAnnotation(Annotation):
    extension: Optional[str] = None

    @overload
    def __init__(
        self, *, label: str, description: Optional[str] = ..., extension: None = ...
    ) -> None: ...
    @overload
    def __init__(
        self, *, label: str, description: Optional[str] = ..., extension: type[OCELExtension]
    ) -> None: ...

    def __init__(self, **data: Any) -> None:
        ext = data.get("extension", None)
        if isinstance(ext, type) and issubclass(ext, OCELExtension):
            data["extension"] = ext.__name__  # coerce class → str

        super().__init__(**data)


class ResourceAnnotation(Annotation):
    pass


class OCELResult(BaseModel):
    type: Literal["ocel"] = "ocel"
    is_list: bool
    annotation: Optional[OCELAnnotation]


class ResourceResult(BaseModel):
    type: Literal["resource"] = "resource"
    resource_type: str
    is_list: bool
    annotation: Optional[ResourceAnnotation]


PluginResult: TypeAlias = Annotated[Union[OCELResult, ResourceResult], Field(discriminator="type")]


PluginReturnItemType = Union[OCEL, Resource, list[OCEL], list[Resource]]
PluginReturnType = Union[tuple[PluginReturnItemType], PluginReturnItemType]


class PluginMethod(BaseModel):
    name: str
    label: Optional[str] = None
    description: Optional[str] = None
    input_ocels: dict[str, OCELAnnotation] = Field(default_factory=dict)
    input_resources: dict[str, tuple[str, ResourceAnnotation]] = Field(default_factory=dict)

    results: list[PluginResult] = Field(default_factory=list)

    _input_model: Optional[type[PluginInput]] = PrivateAttr(default=None)
    _method: Callable[..., PluginReturnType] = PrivateAttr()
    _resource_types: set[type[Resource]] = PrivateAttr(default_factory=set)

    @computed_field
    @cached_property
    def input_schema(self) -> dict[str, Any]:
        return self._input_model.model_json_schema() if self._input_model is not None else {}


def extract_info(typ) -> tuple[type, Optional[Annotation]]:
    if get_origin(typ) is Annotated:
        base_type, *annotations = get_args(typ)
        annotation = next((a for a in annotations if isinstance(a, Annotation)), None)
    else:
        base_type = typ
        annotation = None
    return base_type, annotation


def plugin_method(
    label: Optional[str] = None,
    description: Optional[str] = None,
):
    def decorator(func: Callable[..., PluginReturnType]):
        plugin_method_meta = PluginMethod(name=func.__name__, label=label, description=description)
        method_hints = get_type_hints(func, include_extras=True)

        for arg_name, hint in method_hints.items():
            base_type, annotation = extract_info(hint)

            if not isinstance(base_type, type) or arg_name == "return":
                continue

            if issubclass(base_type, PluginInput):
                plugin_method_meta._input_model = base_type
            elif issubclass(base_type, OCEL):
                plugin_method_meta.input_ocels[arg_name] = (
                    OCELAnnotation(**annotation.model_dump())
                    if annotation is not None
                    else OCELAnnotation(label=arg_name)
                )
            elif issubclass(base_type, Resource):
                plugin_method_meta._resource_types.add(base_type)
                field_info = base_type.model_fields.get("type")

                if field_info is None or field_info.default is None:
                    raise ValueError(
                        f"{base_type.__name__} must define `type: Literal[...] = ...` with a default value."
                    )

                type_value: str = field_info.default

                plugin_method_meta.input_resources[arg_name] = (
                    type_value,
                    ResourceAnnotation(**annotation.model_dump())
                    if annotation is not None
                    else ResourceAnnotation(label=arg_name),
                )
            else:
                raise TypeError(
                    f"Argument {arg_name} must be either an OCEL, Resource or Input Schema"
                )

        return_type = method_hints.get("return", None)

        if return_type is not None:
            origin = get_origin(return_type)

            types_to_parse = []

            if origin is tuple:
                types_to_parse = get_args(return_type)
            else:
                types_to_parse = [return_type]

            for typ in types_to_parse:
                base_type, annotation = extract_info(typ)

                if get_origin(base_type) is list:
                    inner_type = get_args(base_type)[0]
                    base_type, annotation = extract_info(inner_type)
                    is_list = True
                else:
                    is_list = False

                # Now determine what kind of result it is
                if issubclass(base_type, OCEL):
                    plugin_method_meta.results.append(
                        OCELResult(
                            type="ocel",
                            is_list=is_list,
                            annotation=OCELAnnotation(**annotation.model_dump())
                            if annotation is not None
                            else None,
                        )
                    )
                elif issubclass(base_type, Resource):
                    plugin_method_meta._resource_types.add(base_type)
                    resource_type = base_type.model_fields.get("type")
                    if resource_type is None or resource_type.default is None:
                        raise ValueError(
                            f"Resource {base_type.__name__} must define a default `type` field."
                        )
                    plugin_method_meta.results.append(
                        ResourceResult(
                            type="resource",
                            is_list=is_list,
                            annotation=ResourceAnnotation(**annotation.model_dump())
                            if annotation is not None
                            else None,
                            resource_type=resource_type.default,
                        )
                    )
                else:
                    raise TypeError(f"Unsupported return type: {base_type}")

        plugin_method_meta._method = func

        setattr(
            func,
            "__meta__",
            plugin_method_meta,
        )

        return func

    return decorator


# endregion
