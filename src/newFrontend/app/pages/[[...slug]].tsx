import config from "../ocelescope.config";
import { createModulesPage } from "@ocelescope/core";

const page = createModulesPage(config);

export const getStaticPaths = page.getStaticPaths;
export const getStaticProps = page.getStaticProps;

export default page.ModulePage;
