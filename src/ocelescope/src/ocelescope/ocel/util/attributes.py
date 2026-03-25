import pm4py
from pm4py.objects.ocel.obj import OCEL


def get_objects_with_object_changes(ocel: OCEL):
    object_changes = ocel.object_changes

    grouped = object_changes.groupby([ocel.object_id_column, ocel.object_type_column])
    last_changes = grouped.last().reset_index()

    attribute_names = pm4py.ocel_get_attribute_names(ocel)
    available_cols = last_changes.columns.tolist()
    selected_cols = [ocel.object_id_column] + [
        col for col in attribute_names if col in available_cols
    ]

    object_changes_filtered = last_changes[selected_cols]

    object_changes_filtered = object_changes_filtered.set_index(ocel.object_id_column)
    objects = ocel.objects.set_index(ocel.object_id_column)

    return objects.fillna(object_changes_filtered).reset_index()
