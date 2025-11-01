import fs from "fs";
import path from "path";
import { Project, SyntaxKind } from "ts-morph";

const MODULES_DIR = path.resolve(__dirname, "../modules/");
const OUT_FILE = path.resolve(__dirname, "../lib/modules/module-map.ts");

const project = new Project({
  tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
});

const moduleFolders = fs
  .readdirSync(MODULES_DIR)
  .filter((name) => fs.statSync(path.join(MODULES_DIR, name)).isDirectory());

const imports: string[] = [];
const moduleEntries: string[] = [];

let importCounter = 0;

for (const folderName of moduleFolders) {
  const modulePath = `@/modules/${folderName}`;
  const moduleIndexPath = path.join(MODULES_DIR, folderName, "index.ts");
  const indexSource = project.addSourceFileAtPathIfExists(moduleIndexPath);

  const moduleVar = `${folderName}_module`;
  imports.push(`import ${moduleVar} from '${modulePath}';`);

  let moduleName = folderName;

  if (indexSource) {
    const defaultExportSymbol = indexSource.getDefaultExportSymbol();
    const decl = defaultExportSymbol?.getDeclarations()[0];
    if (decl && decl.getKind() === SyntaxKind.VariableDeclaration) {
      const objectLiteral = decl.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      const nameProp = objectLiteral?.getProperty("name");

      if (nameProp?.getKind() === SyntaxKind.PropertyAssignment) {
        const initializer = nameProp.getFirstDescendantByKind(
          SyntaxKind.StringLiteral,
        );
        if (initializer) {
          moduleName = initializer.getLiteralValue();
        }
      }
    }
  }

  const routeFolder = path.join(MODULES_DIR, folderName, "pages");
  const routeDefs: string[] = [];

  if (fs.existsSync(routeFolder)) {
    const files = fs
      .readdirSync(routeFolder)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

    for (const file of files) {
      const absFile = path.join(routeFolder, file);
      const routeSource = project.addSourceFileAtPath(absFile);
      const exportSymbol = routeSource.getDefaultExportSymbol();
      const decl = exportSymbol?.getDeclarations()?.[0];

      const objectLiteral = decl?.getFirstDescendantByKind(
        SyntaxKind.ObjectLiteralExpression,
      );
      const nameProp = objectLiteral?.getProperty("name");

      if (nameProp?.getKind() === SyntaxKind.PropertyAssignment) {
        const initializer = nameProp.getFirstDescendantByKind(
          SyntaxKind.StringLiteral,
        );
        const routeName = initializer?.getLiteralValue();

        if (routeName) {
          const importVar = `R${importCounter++}`;
          const importPath = `${modulePath}/pages/${file.replace(/\.(ts|tsx)$/, "")}`;
          imports.push(`import ${importVar} from '${importPath}';`);
          routeDefs.push(`    "${routeName}": ${importVar}`);
        }
      }
    }
  }

  moduleEntries.push(`  "${moduleName}": {
    ...${moduleVar},
    routes: {
${routeDefs.join(",\n")}
    }
  }`);
}

const output = `// 🚨 AUTO-GENERATED FILE — DO NOT EDIT
${imports.join("\n")}

const moduleMap= {
${moduleEntries.join(",\n")}
} as const;

export default moduleMap;
`;

fs.writeFileSync(OUT_FILE, output);
console.log("✅ module-map.ts generated!");
