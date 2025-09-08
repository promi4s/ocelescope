// 🚨 AUTO-GENERATED FILE — DO NOT EDIT
import filter_module from "@/modules/filter";
import R0 from "@/modules/filter/pages/index";
import ocelot_module from "@/modules/ocelot";
import R1 from "@/modules/ocelot/pages/eventOverview";
import R2 from "@/modules/ocelot/pages/events";
import R3 from "@/modules/ocelot/pages/objectOverview";
import R4 from "@/modules/ocelot/pages/objects";

const moduleMap = {
  filter: {
    ...filter_module,
    routes: {
      filter: R0,
    },
  },
  ocelot: {
    ...ocelot_module,
    routes: {
      eventOverview: R1,
      events: R2,
      objectOverview: R3,
      objects: R4,
    },
  },
} as const;

export default moduleMap;
