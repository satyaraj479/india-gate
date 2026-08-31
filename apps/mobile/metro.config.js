const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/**
 * The three lines that make Expo work inside a monorepo. Every one of them
 * exists because of a concrete failure mode:
 *
 * 1. `watchFolders` — without the workspace root, editing a file in
 *    `packages/core` does not trigger a reload. You save, nothing happens,
 *    and you spend twenty minutes blaming the cache.
 *
 * 2. `nodeModulesPaths` — Metro must look in the workspace root's
 *    node_modules, not only the app's, or every hoisted dependency resolves
 *    to "Unable to resolve module".
 *
 * 3. `disableHierarchicalLookup` — stops Metro walking *up* past the
 *    workspace root and picking up something from a parent directory outside
 *    the repo. Without it, a stray node_modules in the developer's home
 *    directory can silently satisfy an import.
 */
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

/**
 * Workspace packages ship raw TypeScript (`exports: { ".": "./src/index.ts" }`)
 * rather than a build step. Metro transpiles them with Babel like app code,
 * so there is no `turbo build` needed before `expo start`, and no stale-dist
 * class of bug. The cost is that `@indiagate/core` must stay free of anything
 * Hermes cannot run — which the lint rule in that package already enforces.
 */
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "require", "import"];

module.exports = config;
