The packages directory contains all the different modules available in scenic.
Modules like math, scene, renderer and such which are built into libraries
that make up the game engine.

Each one of the modules is published as its own npm module so that you can
use whatever makes most sense to you without bringing extra baggage you
may not need.

Each package has a `src/index.js` which is the API exported by the particular
package and each package generates a bundle in `dest` as a UMD module named
after the name of the package itself. All the packages are under the `@scenic`
organization in NPM so every published package is named like `@scenic/math` and
`@scenic/scene`. The bundler will normalize those names in the UMD definition
to `scenicscene` and `scenicmath`. It would be nice the bundler could also
export the exact package name.

TODO(miguel): improve the bundler to allow us to export the actual package name
rather than the cleaned up string version.

Each module's eslintrc is symlinked to the one in the packages directory. If
you need a custom one then feel free to create a separate non symlinked file
in the module that needs it. To symlink it you can run a command like below
from the root folder; be sure to switch out `math` in the path for the
specific module you want to configure.

```
$ ln -sf ../.eslintrc.js packages/math/.eslintrc.js
```

Babel is only used by the tests, with the project's config at the root
(`babel.config.json`), which each module's jest config points to.

Modules aren't built on their own: each one's `main` is its source, and the
apps bundle them from it (see `bin/build.js`, which `npm run build` runs from
the root directory).

Each module also has tests that you can run with `npm run test --workspaces`,
and `npm run test` in each module if you want to run the tests for a particular
module.
