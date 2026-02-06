import createModulesPage from "@/lib/modules/createModulesPage";
import config from "@/ocelescope.config";

const page = createModulesPage(config);

export const getStaticPaths = page.getStaticPaths;
export const getStaticProps = page.getStaticProps;

export default page.ModulePage;
