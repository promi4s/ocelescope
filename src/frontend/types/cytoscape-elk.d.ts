declare module "cytoscape-elk" {
  const register: (cy: typeof cytoscape) => void;
  export default register;
}
