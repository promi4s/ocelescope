from dataclasses import dataclass
import inspect
from typing import (
    Annotated,
    Callable,
    Optional,
    Type,
    TypedDict,
    get_origin,
    get_type_hints,
    get_args,
)
from pydantic import BaseModel
from ocelescope import OCEL

from util.tasks import task


class MethodInfo(TypedDict):
    input_model: Optional[Type[BaseModel]]
    output_model: Optional[Type[BaseModel]]
    method: Callable


@dataclass
class OCELAnnotation:
    label: Optional[str] = None
    description: Optional[str] = None


class PluginOCEL(BaseModel):
    name: str
    label: Optional[str]
    description: Optional[str]


class PluginMethod(BaseModel):
    name: str
    label: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    input_model: Optional[dict] = None
    input_ocels: list[PluginOCEL]


class PluginMetadata(BaseModel):
    name: str
    label: str
    version: str
    description: Optional[str]


class PluginDescription(BaseModel):
    metadata: PluginMetadata
    methods: dict[str, PluginMethod]


class BasePlugin:
    @classmethod
    def describe(cls) -> PluginDescription:
        plugin_meta = getattr(cls, "_plugin_metadata", {})
        methods_info: dict[str, PluginMethod] = {}

        for name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
            if not hasattr(method, "_plugin_method_metadata"):
                continue

            hints = get_type_hints(method, include_extras=True)

            input_model = hints.get("input")

            if not (
                (isinstance(input_model, type) and issubclass(input_model, BaseModel))
                or (input_model is None)
            ):
                continue

            ocel_fields: list[PluginOCEL] = []

            for ocel_name, hint in hints.items():
                annotations = []
                if get_origin(hint) is Annotated:
                    base_type, *annotations = get_args(hint)
                else:
                    base_type = hint

                if not (isinstance(base_type, type) and issubclass(base_type, OCEL)):
                    continue

                label = None
                description = None

                for annotation in annotations:
                    if isinstance(annotation, OCELAnnotation):
                        label = annotation.label
                        description = annotation.description

                ocel_fields.append(
                    PluginOCEL(
                        name=ocel_name,
                        label=label or ocel_name,
                        description=description,
                    )
                )

            method_meta = getattr(method, "_plugin_method_metadata", {})

            methods_info[name] = PluginMethod(
                name=name,
                label=method_meta.get("label", name),
                description=method_meta.get("description"),
                tags=method_meta.get("tags", []),
                input_model=input_model.model_json_schema()
                if input_model is not None
                else None,
                input_ocels=ocel_fields,
            )

        return PluginDescription(
            metadata=PluginMetadata(
                name=plugin_meta.get("name", cls.__name__),
                label=plugin_meta.get("label", ""),
                version=plugin_meta.get("version", "0.1"),
                description=plugin_meta.get("description", ""),
            ),
            methods=methods_info,
        )

    @classmethod
    def get_method_map(cls, plugin_id: str) -> dict[str, MethodInfo]:
        method_map = {}
        for name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
            if not hasattr(method, "_plugin_method_metadata"):
                continue

            hints = get_type_hints(method)

            input_model = hints.get("input")
            output_model = hints.get("return")

            # Wrap method with task decorator
            task_name = f"{plugin_id}:{name}"
            original_method = getattr(cls(), name)

            method_meta = getattr(method, "_plugin_method_metadata", {})

            task_wrapped = task(
                name=task_name,
                dedupe=True,
                run_once=False,
                success_message=f"{method_meta.get('label', name)} run successfully",
            )(original_method)

            method_map[name] = MethodInfo(
                input_model=input_model
                if input_model is not None and issubclass(input_model, BaseModel)
                else None,
                output_model=output_model
                if output_model is not None and issubclass(output_model, BaseModel)
                else None,
                method=task_wrapped,
            )

        return method_map
