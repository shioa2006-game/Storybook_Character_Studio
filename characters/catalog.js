import { builtins } from './builtins.js';
import { additions } from './catalog.generated.js';
import { buildCatalog } from './metadata.js';
export const catalog = buildCatalog([...builtins, ...additions]);
export const findCharacter = id => catalog.find(entry => entry.id === id);
