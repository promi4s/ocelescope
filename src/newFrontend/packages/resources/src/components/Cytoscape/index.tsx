// components/Cytoscape/index.ts

import dynamic from "next/dynamic";

// This disables SSR for CytoscapeGraph everywhere
export default dynamic(() => import("./Cytoscape"), { ssr: false });
