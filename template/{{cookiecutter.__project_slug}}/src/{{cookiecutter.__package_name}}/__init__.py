from .plugin import {% if cookiecutter.include_example_extension|lower == 'yes' %}MinimalExtension, {% endif %}{{cookiecutter.__plugin_class_name}}

__author__ = "{{ cookiecutter.author_name}}"
__email__ = "{{ cookiecutter.email }}"


__all__ = [
    "{{cookiecutter.__plugin_class_name}}",
    {% if cookiecutter.include_example_extension|lower == 'yes' %}"MinimalExtension",{% endif %}
]
