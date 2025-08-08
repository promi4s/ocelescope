from ocelescope import OCEL
from ocelescope.plugin import Plugin
from ocelescope.plugin.decorators import plugin_meta, plugin_method


@plugin_meta(name="Test Plugin")
class Test(Plugin):
    @plugin_method(label="Test Method", description="This is a test")
    def test(self, ocel: OCEL):
        return
