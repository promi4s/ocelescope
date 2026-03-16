import { sseHandler } from "@ocelescope/core";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default sseHandler;
